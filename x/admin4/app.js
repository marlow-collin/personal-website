(() => {
  "use strict";

  const status = document.querySelector("#status");
  const metrics = document.querySelector("#metrics");
  const totalCount = document.querySelector("#totalCount");
  const activeCount = document.querySelector("#activeCount");
  const archivedCount = document.querySelector("#archivedCount");
  const groupCount = document.querySelector("#groupCount");
  const refreshButton = document.querySelector("#refreshButton");

  const questionsStatus = document.querySelector("#questionsStatus");
  const questionsTable = document.querySelector("#questionsTable");
  const questionsResultCount = document.querySelector("#questionsResultCount");
  const refreshQuestionsButton = document.querySelector("#refreshQuestionsButton");
  const newQuestionButton = document.querySelector("#newQuestionButton");
  const questionSearch = document.querySelector("#questionSearch");
  const statusFilter = document.querySelector("#statusFilter");
  const categoryFilter = document.querySelector("#categoryFilter");
  const intensityFilter = document.querySelector("#intensityFilter");
  const topicFilter = document.querySelector("#topicFilter");
  const contextFilter = document.querySelector("#contextFilter");
  const participantsFilter = document.querySelector("#participantsFilter");

  const questionDialog = document.querySelector("#questionDialog");
  const questionForm = document.querySelector("#questionForm");
  const editorHeading = document.querySelector("#editorHeading");
  const editorId = document.querySelector("#editorId");
  const editorText = document.querySelector("#editorText");
  const editorCategories = document.querySelector("#editorCategories");
  const editorIntensity = document.querySelector("#editorIntensity");
  const editorTopics = document.querySelector("#editorTopics");
  const editorContexts = document.querySelector("#editorContexts");
  const editorGroupOnly = document.querySelector("#editorGroupOnly");
  const editorStatus = document.querySelector("#editorStatus");
  const editorStatusMessage = document.querySelector("#editorStatusMessage");
  const closeEditorButton = document.querySelector("#closeEditorButton");
  const deleteQuestionButton = document.querySelector("#deleteQuestionButton");
  const saveQuestionButton = document.querySelector("#saveQuestionButton");

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
  let questionStore = [];
  let questionSchema = null;
  let editingQuestionId = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[char]);
  }

  function optionMarkup(values) {
    return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function checkboxMarkup(name, values) {
    return values.map((value) => `
      <label class="inline-choice">
        <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}">
        <span>${escapeHtml(value)}</span>
      </label>`).join("");
  }

  async function apiJson(path, options = {}) {
    const response = await fetch(path, {
      cache: "no-store",
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) {
      const error = new Error(data.detail || data.error || `HTTP ${response.status}`);
      error.data = data;
      throw error;
    }
    return data;
  }

  async function loadStatus() {
    refreshButton.disabled = true;
    status.className = "status";
    status.textContent = "Prüfe Verbindung …";
    metrics.hidden = true;

    try {
      const data = await apiJson("/x/admin4/api/status");
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

  function populateQuestionControls(schema) {
    if (!schema) return;
    statusFilter.innerHTML = `<option value="">Alle</option>${optionMarkup(schema.statuses || [])}`;
    categoryFilter.innerHTML = `<option value="">Alle</option>${optionMarkup(schema.categories || [])}`;
    intensityFilter.innerHTML = `<option value="">Alle</option>${optionMarkup(schema.intensities || [])}`;
    topicFilter.innerHTML = `<option value="">Alle</option>${optionMarkup(schema.topics || [])}`;
    contextFilter.innerHTML = `<option value="">Alle</option><option value="__universal">universell</option>${optionMarkup(schema.contexts || [])}`;

    editorCategories.innerHTML = checkboxMarkup("categories", schema.categories || []);
    editorTopics.innerHTML = checkboxMarkup("topics", schema.topics || []);
    editorContexts.innerHTML = checkboxMarkup("contexts", schema.contexts || []);
    editorIntensity.innerHTML = optionMarkup(schema.intensities || []);
    editorStatus.innerHTML = optionMarkup(schema.statuses || []);
  }

  function filteredQuestions() {
    const search = questionSearch.value.trim().toLocaleLowerCase("de-DE");
    const statusValue = statusFilter.value;
    const category = categoryFilter.value;
    const intensity = intensityFilter.value;
    const topic = topicFilter.value;
    const context = contextFilter.value;
    const participants = participantsFilter.value;

    return questionStore.filter((question) => {
      if (search && !`${question.id} ${question.text}`.toLocaleLowerCase("de-DE").includes(search)) return false;
      if (statusValue && question.status !== statusValue) return false;
      if (category && !(question.categories || []).includes(category)) return false;
      if (intensity && question.intensity !== intensity) return false;
      if (topic && !(question.topics || []).includes(topic)) return false;
      if (context === "__universal" && (question.contexts || []).length !== 0) return false;
      if (context && context !== "__universal" && !(question.contexts || []).includes(context)) return false;
      if (participants === "3" && question.minParticipants !== 3) return false;
      if (participants === "2" && question.minParticipants === 3) return false;
      return true;
    });
  }

  function renderQuestions() {
    const questions = filteredQuestions();
    questionsResultCount.textContent = `${questions.length} von ${questionStore.length} Fragen`;

    if (!questions.length) {
      questionsTable.innerHTML = `<p class="empty-state">Keine Fragen für die aktuellen Filter.</p>`;
      return;
    }

    questionsTable.innerHTML = `
      <table class="questions-table">
        <thead>
          <tr><th>Frage</th><th>Metadaten</th><th>Status</th><th>Aktionen</th></tr>
        </thead>
        <tbody>${questions.map((question) => `
          <tr class="${question.status === "archived" ? "is-archived" : ""}">
            <td>
              <div class="question-text">${escapeHtml(question.text)}</div>
              <code class="question-id">${escapeHtml(question.id)}</code>
            </td>
            <td class="metadata-cell">
              <span>${escapeHtml((question.categories || []).join(", "))}</span>
              <span>${escapeHtml(question.intensity)}</span>
              <span>${escapeHtml((question.topics || []).join(", "))}</span>
              <span>${(question.contexts || []).length ? escapeHtml(question.contexts.join(", ")) : "universell"}${question.minParticipants === 3 ? " · 3+" : ""}</span>
            </td>
            <td><span class="status-pill status-pill--${escapeHtml(question.status)}">${escapeHtml(question.status)}</span></td>
            <td>
              <div class="row-actions">
                <button type="button" class="secondary compact" data-action="edit" data-id="${escapeHtml(question.id)}">Bearbeiten</button>
                <button type="button" class="secondary compact" data-action="toggle" data-id="${escapeHtml(question.id)}">${question.status === "active" ? "Archivieren" : "Reaktivieren"}</button>
              </div>
            </td>
          </tr>`).join("")}</tbody>
      </table>`;
  }

  async function loadQuestions() {
    refreshQuestionsButton.disabled = true;
    questionsStatus.className = "status";
    questionsStatus.textContent = "Lade Fragenbestand …";

    try {
      const data = await apiJson("/x/admin4/api/questions");
      questionStore = Array.isArray(data.questions) ? data.questions : [];
      const schemaChanged = JSON.stringify(questionSchema) !== JSON.stringify(data.schema);
      questionSchema = data.schema || null;
      if (schemaChanged) populateQuestionControls(questionSchema);
      renderQuestions();
      questionsStatus.className = "status status--ok";
      questionsStatus.textContent = `${questionStore.length} Fragen geladen.`;
    } catch (error) {
      questionStore = [];
      renderQuestions();
      questionsStatus.className = "status status--error";
      questionsStatus.textContent = `Bestand konnte nicht geladen werden: ${error.message}`;
    } finally {
      refreshQuestionsButton.disabled = false;
    }
  }

  function setChecked(name, values) {
    const selected = new Set(values || []);
    questionForm.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function openQuestionEditor(question = null) {
    if (!questionSchema) {
      questionsStatus.className = "status status--error";
      questionsStatus.textContent = "Schema noch nicht geladen. Bestand erneut laden.";
      return;
    }

    editingQuestionId = question?.id || null;
    editorHeading.textContent = question ? "Frage bearbeiten" : "Neue Frage";
    editorId.textContent = question?.id || "ID wird beim Speichern erzeugt.";
    editorText.value = question?.text || "";
    editorIntensity.value = question?.intensity || questionSchema.intensities?.[0] || "light";
    editorStatus.value = question?.status || "active";
    editorGroupOnly.checked = question?.minParticipants === 3;
    setChecked("categories", question?.categories || []);
    setChecked("topics", question?.topics || []);
    setChecked("contexts", question?.contexts || []);
    deleteQuestionButton.hidden = !question;
    editorStatusMessage.className = "status";
    editorStatusMessage.textContent = question ? "Änderungen noch nicht gespeichert." : "Neue Frage noch nicht gespeichert.";
    questionDialog.showModal();
    editorText.focus();
  }

  function editorValues(name) {
    return [...questionForm.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function editorPayload() {
    return {
      text: editorText.value,
      categories: editorValues("categories"),
      intensity: editorIntensity.value,
      topics: editorValues("topics"),
      contexts: editorValues("contexts"),
      minParticipants: editorGroupOnly.checked ? 3 : null,
      status: editorStatus.value
    };
  }


  function editableQuestionPayload(question, statusOverride = null) {
    return {
      text: question.text,
      categories: [...(question.categories || [])],
      intensity: question.intensity,
      topics: [...(question.topics || [])],
      contexts: [...(question.contexts || [])],
      minParticipants: question.minParticipants ?? null,
      status: statusOverride ?? question.status
    };
  }

  function formatApiIssues(data) {
    const items = [...(data?.errors || []), ...(data?.warnings || [])];
    if (!items.length) return "";
    return items.map((item) => `${item.path || "question"}: ${item.message}`).join(" · ");
  }

  async function saveQuestion(event) {
    event.preventDefault();
    saveQuestionButton.disabled = true;
    deleteQuestionButton.disabled = true;
    editorStatusMessage.className = "status";
    editorStatusMessage.textContent = "Speichere …";

    try {
      const path = editingQuestionId
        ? `/x/admin4/api/questions/${encodeURIComponent(editingQuestionId)}`
        : "/x/admin4/api/questions";
      const method = editingQuestionId ? "PATCH" : "POST";
      const data = await apiJson(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: editorPayload() })
      });

      editingQuestionId = data.question?.id || editingQuestionId;
      editorId.textContent = editingQuestionId || "";
      deleteQuestionButton.hidden = !editingQuestionId;
      const warningText = formatApiIssues({ warnings: data.warnings || [] });
      editorStatusMessage.className = "status status--ok";
      editorStatusMessage.textContent = warningText ? `Gespeichert. Hinweis: ${warningText}` : "Gespeichert.";
      await Promise.all([loadQuestions(), loadStatus()]);
    } catch (error) {
      const issues = formatApiIssues(error.data);
      editorStatusMessage.className = "status status--error";
      editorStatusMessage.textContent = issues || `Speichern fehlgeschlagen: ${error.message}`;
    } finally {
      saveQuestionButton.disabled = false;
      deleteQuestionButton.disabled = false;
    }
  }

  async function toggleArchive(id) {
    const question = questionStore.find((item) => item.id === id);
    if (!question) return;
    const nextStatus = question.status === "active" ? "archived" : "active";
    questionsStatus.className = "status";
    questionsStatus.textContent = nextStatus === "archived" ? "Archiviere Frage …" : "Reaktiviere Frage …";

    try {
      await apiJson(`/x/admin4/api/questions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: editableQuestionPayload(question, nextStatus) })
      });
      await Promise.all([loadQuestions(), loadStatus()]);
    } catch (error) {
      questionsStatus.className = "status status--error";
      questionsStatus.textContent = `Statuswechsel fehlgeschlagen: ${formatApiIssues(error.data) || error.message}`;
    }
  }

  async function deleteCurrentQuestion() {
    if (!editingQuestionId) return;
    const question = questionStore.find((item) => item.id === editingQuestionId);
    const confirmed = window.confirm(`Frage endgültig löschen?\n\n${question?.text || editingQuestionId}\n\nArchivieren ist normalerweise die bessere Wahl. Dieser Vorgang kann nicht rückgängig gemacht werden.`);
    if (!confirmed) return;

    deleteQuestionButton.disabled = true;
    saveQuestionButton.disabled = true;
    editorStatusMessage.className = "status";
    editorStatusMessage.textContent = "Lösche endgültig …";

    try {
      await apiJson(`/x/admin4/api/questions/${encodeURIComponent(editingQuestionId)}`, { method: "DELETE" });
      questionDialog.close();
      editingQuestionId = null;
      await Promise.all([loadQuestions(), loadStatus()]);
    } catch (error) {
      editorStatusMessage.className = "status status--error";
      editorStatusMessage.textContent = `Löschen fehlgeschlagen: ${error.message}`;
    } finally {
      deleteQuestionButton.disabled = false;
      saveQuestionButton.disabled = false;
    }
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

    const extra = note ? `\nZusätzliche Vorgabe für diesen Batch:\n${note}\n` : "";
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

    const previewRows = Array.isArray(data.preview) ? data.preview : [];
    if (!previewRows.length) {
      importPreview.innerHTML = "";
      return;
    }

    importPreview.innerHTML = `
      <h3>Vorschau</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Text</th><th>Kategorien</th><th>Intensität</th><th>Topics</th><th>Status</th></tr></thead>
          <tbody>${previewRows.map((row) => `
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
    return apiJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document })
    });
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
      importStatus.textContent = error instanceof SyntaxError ? `Ungültiges JSON: ${error.message}` : error.message;
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
      await Promise.all([loadStatus(), loadQuestions()]);
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

  [questionSearch, statusFilter, categoryFilter, intensityFilter, topicFilter, contextFilter, participantsFilter]
    .forEach((control) => control.addEventListener("input", renderQuestions));

  questionsTable.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const question = questionStore.find((item) => item.id === button.dataset.id);
    if (!question) return;
    if (button.dataset.action === "edit") openQuestionEditor(question);
    if (button.dataset.action === "toggle") toggleArchive(question.id);
  });

  generationCount.addEventListener("input", buildGenerationPrompt);
  generationNote.addEventListener("input", buildGenerationPrompt);
  copyPromptButton.addEventListener("click", copyPrompt);
  refreshButton.addEventListener("click", loadStatus);
  refreshQuestionsButton.addEventListener("click", loadQuestions);
  newQuestionButton.addEventListener("click", () => openQuestionEditor());
  closeEditorButton.addEventListener("click", () => questionDialog.close());
  questionForm.addEventListener("submit", saveQuestion);
  deleteQuestionButton.addEventListener("click", deleteCurrentQuestion);
  validateButton.addEventListener("click", validateImport);
  commitButton.addEventListener("click", commitImport);

  buildGenerationPrompt();
  loadStatus();
  loadQuestions();
})();
