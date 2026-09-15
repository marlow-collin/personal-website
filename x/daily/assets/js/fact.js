(() => {
  const root = document.querySelector("[data-daily-fact]");
  if (!root) return;

  const loading = root.querySelector("[data-loading]");
  const content = root.querySelector("[data-content]");
  const empty = root.querySelector("[data-empty]");
  const error = root.querySelector("[data-error]");
  const retry = root.querySelector("[data-retry]");
  const date = root.querySelector("[data-date]");
  const factText = root.querySelector("[data-fact-text]");
  const explanationText = root.querySelector("[data-explanation-text]");
  const sourcesWrap = root.querySelector("[data-sources-wrap]");
  const sourcesList = root.querySelector("[data-sources]");

  const setState = (state) => {
    loading.hidden = state !== "loading";
    content.hidden = state !== "ready";
    empty.hidden = state !== "empty";
    error.hidden = state !== "error";
    root.querySelector(".daily-reveal").dataset.state = state;
  };

  const formatDate = (isoDate) => {
    const parsed = new Date(`${isoDate}T12:00:00Z`);
    return new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin"
    }).format(parsed);
  };

  const renderSources = (sources) => {
    sourcesList.replaceChildren();
    const usable = Array.isArray(sources) ? sources.filter((source) => source?.title) : [];
    sourcesWrap.hidden = usable.length === 0;

    for (const source of usable) {
      const item = document.createElement("li");
      if (source.url) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.publisher
          ? `${source.title} — ${source.publisher}`
          : source.title;
        item.append(link);
      } else {
        item.textContent = source.publisher
          ? `${source.title} — ${source.publisher}`
          : source.title;
      }
      sourcesList.append(item);
    }
  };

  async function loadFact() {
    setState("loading");

    try {
      const response = await fetch("/x/api/daily/fact/activate", {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.state === "empty") {
        date.textContent = formatDate(data.date);
        setState("empty");
        return;
      }

      if (data.state !== "ready") throw new Error("Unexpected response state");

      date.textContent = formatDate(data.date);
      factText.textContent = data.content?.fact?.text || "";
      explanationText.textContent = data.content?.explanation?.text || "";
      renderSources(data.content?.sources || []);
      setState("ready");
    } catch (loadError) {
      console.error(loadError);
      setState("error");
    }
  }

  retry.addEventListener("click", loadFact);
  loadFact();
})();
