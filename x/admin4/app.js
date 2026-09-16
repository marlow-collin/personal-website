(() => {
  "use strict";

  const status = document.querySelector("#status");
  const metrics = document.querySelector("#metrics");
  const totalCount = document.querySelector("#totalCount");
  const activeCount = document.querySelector("#activeCount");
  const archivedCount = document.querySelector("#archivedCount");
  const groupCount = document.querySelector("#groupCount");
  const refreshButton = document.querySelector("#refreshButton");

  const generationCount = document.querySelector("#generationCount");
  const generationNote = document.querySelector("#generationNote");
  const generationBriefLink = document.querySelector("#generationBriefLink");
  const generationPrompt = document.querySelector("#generationPrompt");
  const copyPromptButton = document.querySelector("#copyPromptButton");
  const copyStatus = document.querySelector("#copyStatus");

  const fileInput = document.querySelector("#fileInput");
  const jsonInput = document.querySelector("#jsonInput");
  const validateButton = document.querySelector("#validateButton");
  const commitButton = document.querySelector("#commitButton");
  const clearButton = document.querySelector("#clearButton");
  const importStatus = document.querySelector("#importStatus");
  const importSummary = document.querySelector("#importSummary");
  const importIssues = document.querySelector("#importIssues");
  const importPreview = document.querySelector("#importPreview");

  let currentDocument = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[char]);
  }

  function clampGenerationCount() {
    const parsed = Number.parseInt(generationCount.value, 10);
    const count = Number.isFinite(parsed) ? Math.min(150, Math.max(1, parsed)) : 80;
    generationCount.value = String(count);
    return count;
  }

  function buildGenerationPrompt() {
    const count = clampGenerationCount();
    const note = generationNote.value.trim();
    generationBriefLink.href = `/x/admin4/api/export/generation-brief?count=${count}`;

    const extra = note
      ? `\nZusätzliche Vorgabe für diesen Batch:\n${note}\n`
      : "";

    generationPrompt.value = `Bitte lies zuerst vollständig die fünf hochgeladenen Dateien:\n\n1. Conversation_Generation_Handoff_v1.md\n2. Conversation_Import_Template_v1.json\n3. Conversation_Content_LLM_Review.json\n4. Conversation_Generation_Brief.json\n5. Conversation_Import_Format_v1.md\n\nErstelle anschließend bis zu ${count} neue hochwertige deutsche Conversation-Roulette-Fragen. Der Generation Brief wurde live aus dem aktuellen D1-Bestand erstellt und soll aktiv genutzt werden, um bestehende Lücken und Ungleichgewichte auszugleichen.${extra}\nWichtig:\n- Prüfe den vollständigen Review-Export zuerst auf exakte und sehr ähnliche Fragen; aktive und archivierte Einträge gelten gleichermaßen als bereits vorhanden.\n- Erzeuge keine bloßen Umformulierungen vorhandener Gesprächsideen.\n- Halte dich strikt an Kategorien, Topics, Contexts, Intensitäten und alle Regeln aus dem Handoff.\n- Qualität und echte Vielfalt sind wichtiger als das Erzwingen der Zielmenge.\n- Gib die neuen Einträge ausschließlich im kanonischen JSON-Importformat ohne IDs und ohne status-Feld aus.\n- Erstelle am Ende eine vollständige UTF-8-JSON-Datei, die direkt über /x/admin4/ validiert und importiert werden kann.\n- Stelle keine Rückfrage, wenn die fünf Dateien und diese Nachricht alle notwendigen Angaben enthalten.`;
    copyStatus.textContent = "";
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(generationPrompt.value);
      copyStatus.textContent = "Kopiert.";
    } catch {
      generationPrompt.focus();
      generationPrompt.select();
      const copied = document.execCommand("copy");
      copyStatus.textContent = copied ? "Kopiert." : "Bitte manuell kopieren.";
    }
  }

  async function loadStatus() {
    refreshButton.disabled = true;
    status.className = "status";
    status.textContent = "Prüfe Verbindung …";
    metrics.hidden = true;

    try {
      const response = await fetch("/x/admin4/api/status", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      status.className = "status status--ok";
      status.textContent = "D1 ist verbunden und das Conversation-Schema ist erreichbar.";
      totalCount.textContent = String(data.summary?.total ?? 0);
      activeCount.textContent = String(data.summary?.active ?? 0);
      archivedCount.textContent = String(data.summary?.archived ?? 0);
      groupCount.textContent = String(data.summary?.groupOnly ?? 0);
      metrics.hidden = false;
    } catch (error) {
      status.className = "status status--error";
      status.textContent = `Verbindung fehlgeschlagen: ${error.message}`;
    } finally {
      refreshButton.disabled = false;
    }
  }

  function resetImportResult() {
    currentDocument = null;
    commitButton.disabled = true;
    importStatus.className = "status";
    importStatus.textContent = "Noch nichts validiert.";
    importSummary.innerHTML = "";
    importIssues.innerHTML = "";
    importPreview.innerHTML = "";
  }

  function parseInput() {
    const raw = jsonInput.value.trim();
    if (!raw) throw new Error("Kein JSON eingegeben.");
    return JSON.parse(raw);
  }

  function showIssues(data) {
    const errors = (data.errors || []).map((item) => ({ ...item, kind: "error" }));
    const warnings = (data.warnings || []).map((item) => ({ ...item, kind: "warning" }));
    const all = [...errors, ...warnings];
    if (!all.length) {
      importIssues.innerHTML = "";
      return;
    }

    importIssues.innerHTML = `<h3>Hinweise</h3><ul class="issue-list">${all.map((item) => `
      <li class="${item.kind}">
        <code>${escapeHtml(item.path || "document")}</code>: ${escapeHtml(item.message)}
      </li>`).join("")}</ul>`;
  }

  function showPreview(data) {
    const summary = data.summary || {};
    importSummary.innerHTML = `
      <div class="summary-row">
        <span>Gesamt: <strong>${summary.total ?? 0}</strong></span>
        <span>Valide: <strong>${summary.valid ?? 0}</strong></span>
        <span>Duplikate: <strong>${summary.duplicates ?? 0}</strong></span>
        <span>Ähnlichkeitswarnungen: <strong>${summary.similarityWarnings ?? 0}</strong></span>
      </div>`;

    const rows = Array.isArray(data.preview) ? data.preview : [];
    if (!rows.length) {
      importPreview.innerHTML = "";
      return;
    }

    importPreview.innerHTML = `
      <h3>Vorschau</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Text</th><th>Kategorien</th><th>Intensität</th><th>Topics</th><th>Status</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td>${row.index + 1}</td>
              <td>${escapeHtml(row.text)}</td>
              <td>${escapeHtml((row.categories || []).join(", "))}</td>
              <td>${escapeHtml(row.intensity)}</td>
              <td>${escapeHtml((row.topics || []).join(", "))}</td>
              <td>${row.duplicate ? "Duplikat" : "bereit"}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  async function callImportApi(path, document) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({ document })
    });
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
    return data;
  }

  async function validateImport() {
    commitButton.disabled = true;
    try {
      currentDocument = parseInput();
      importStatus.className = "status";
      importStatus.textContent = "Validierung läuft …";
      const data = await callImportApi("/x/admin4/api/import/validate", currentDocument);
      showPreview(data);
      showIssues(data);

      if (data.ok) {
        importStatus.className = "status status--ok";
        importStatus.textContent = `Validierung erfolgreich – ${data.summary?.total ?? 0} Fragen können importiert werden.`;
        commitButton.disabled = false;
      } else {
        importStatus.className = "status status--error";
        importStatus.textContent = "Validierung fehlgeschlagen. Fehler vor dem Import beheben.";
      }
    } catch (error) {
      currentDocument = null;
      importStatus.className = "status status--error";
      importStatus.textContent = error instanceof SyntaxError
        ? `Ungültiges JSON: ${error.message}`
        : error.message;
      importSummary.innerHTML = "";
      importIssues.innerHTML = "";
      importPreview.innerHTML = "";
    }
  }

  async function commitImport() {
    if (!currentDocument) return;
    commitButton.disabled = true;
    validateButton.disabled = true;
    importStatus.className = "status";
    importStatus.textContent = "Import läuft …";

    try {
      const data = await callImportApi("/x/admin4/api/import/commit", currentDocument);
      showIssues(data);
      if (!data.committed) {
        showPreview(data);
        importStatus.className = "status status--error";
        importStatus.textContent = "Import wurde nicht durchgeführt. Bitte erneut validieren.";
        return;
      }

      importStatus.className = "status status--ok";
      importStatus.textContent = `Import erfolgreich: ${data.imported} Fragen wurden als active gespeichert.`;
      currentDocument = null;
      await loadStatus();
    } catch (error) {
      importStatus.className = "status status--error";
      importStatus.textContent = `Import fehlgeschlagen: ${error.message}`;
    } finally {
      validateButton.disabled = false;
    }
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    jsonInput.value = await file.text();
    resetImportResult();
    importStatus.textContent = `${file.name} geladen. Noch nicht validiert.`;
  });

  clearButton.addEventListener("click", () => {
    jsonInput.value = "";
    fileInput.value = "";
    resetImportResult();
  });

  generationCount.addEventListener("input", buildGenerationPrompt);
  generationNote.addEventListener("input", buildGenerationPrompt);
  copyPromptButton.addEventListener("click", copyPrompt);
  refreshButton.addEventListener("click", loadStatus);
  validateButton.addEventListener("click", validateImport);
  commitButton.addEventListener("click", commitImport);

  buildGenerationPrompt();
  loadStatus();
})();
