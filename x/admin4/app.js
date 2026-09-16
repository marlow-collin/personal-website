(() => {
  "use strict";

  const status = document.querySelector("#status");
  const metrics = document.querySelector("#metrics");
  const totalCount = document.querySelector("#totalCount");
  const activeCount = document.querySelector("#activeCount");
  const archivedCount = document.querySelector("#archivedCount");
  const refreshButton = document.querySelector("#refreshButton");
  const details = document.querySelector("#details");
  const raw = document.querySelector("#raw");

  async function loadStatus() {
    refreshButton.disabled = true;
    status.className = "status";
    status.textContent = "Prüfe Verbindung …";
    metrics.hidden = true;
    details.hidden = true;

    try {
      const response = await fetch("/x/admin4/api/status", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      status.className = "status status--ok";
      status.textContent = "D1 ist verbunden und das Conversation-Schema ist erreichbar.";
      totalCount.textContent = String(data.summary?.total ?? 0);
      activeCount.textContent = String(data.summary?.active ?? 0);
      archivedCount.textContent = String(data.summary?.archived ?? 0);
      metrics.hidden = false;
      raw.textContent = JSON.stringify(data, null, 2);
      details.hidden = false;
    } catch (error) {
      status.className = "status status--error";
      status.textContent = `Verbindung fehlgeschlagen: ${error.message}`;
    } finally {
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", loadStatus);
  loadStatus();
})();
