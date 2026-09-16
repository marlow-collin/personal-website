(() => {
  "use strict";

  const states = {
    loading: document.querySelector("#loadingState"),
    ready: document.querySelector("#readyState"),
    empty: document.querySelector("#emptyState"),
    error: document.querySelector("#errorState")
  };
  const readyCopy = document.querySelector("#readyCopy");
  const errorCopy = document.querySelector("#errorCopy");
  const retryButton = document.querySelector("#retryButton");

  function show(name) {
    for (const [key, element] of Object.entries(states)) {
      element.hidden = key !== name;
    }
  }

  function isQuestionShape(question) {
    return question
      && typeof question.id === "string"
      && typeof question.text === "string"
      && Array.isArray(question.categories)
      && typeof question.intensity === "string"
      && Array.isArray(question.topics)
      && Array.isArray(question.contexts)
      && (question.minParticipants === null || question.minParticipants === 3);
  }

  async function loadQuestions() {
    show("loading");

    try {
      const response = await fetch("/x/api/conversation/questions", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!Array.isArray(data.questions)) {
        throw new Error("Ungültige Serverantwort");
      }

      const validQuestions = data.questions.filter(isQuestionShape);
      if (validQuestions.length === 0) {
        show("empty");
        return;
      }

      readyCopy.textContent = `${validQuestions.length} aktive Fragen wurden in den flüchtigen Session-Pool geladen.`;
      show("ready");
    } catch (error) {
      errorCopy.textContent = error.message || "Bitte versuche es erneut.";
      show("error");
    }
  }

  retryButton.addEventListener("click", loadQuestions);
  loadQuestions();
})();
