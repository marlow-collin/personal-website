(() => {
  "use strict";

  const SLUG = "und-wie-wars";
  const API = `/x/api/checkin/${SLUG}`;

  const content = {
    good: {
      eyebrow: "das klingt gut.",
      title: "Das ist schön zu hören.",
      copy: "Du bist bis hierhin gekommen, hast das Gespräch hinter dich gebracht und gehst mit einem guten Gefühl raus. Mehr muss daraus heute auch noch gar nicht werden.",
      emphasis: "Für heute ist das ziemlich viel wert.",
      tail: "Den Rest dürfen jetzt erstmal die anderen entscheiden."
    },
    unsure: {
      eyebrow: "fair.",
      title: "Das ist wahrscheinlich die ehrlichste Antwort.",
      copy: "Nach so einem Gespräch ist der eigene Kopf nicht unbedingt der neutralste Beobachter. Plötzlich werden Blicke, Pausen und irgendwelche halben Sätze analysiert, die wahrscheinlich gar nichts bedeutet haben.",
      emphasis: "Du musst die Lücken gerade nicht mit Zweifeln füllen.",
      tail: "Du musst das heute nicht mehr lösen."
    },
    bad: {
      eyebrow: "okay.",
      title: "Dann lassen wir es auch einfach schlecht gewesen sein.",
      copy: "Kein Schönreden und kein „Aber vielleicht …“ nötig. Du hast dich vorbereitet, bist hingegangen und dich zwei Stunden diesem Gespräch gestellt. Wie sich diese zwei Stunden angefühlt haben, definiert nicht, was du kannst.",
      emphasis: "Für heute darf es einfach nur doof gewesen sein.",
      tail: "Morgen ist immer noch genug Zeit zum Einordnen."
    }
  };

  const loadingView = document.querySelector("#loadingView");
  const questionView = document.querySelector("#questionView");
  const questionTitle = document.querySelector("#questionTitle");
  const resultView = document.querySelector("#resultView");
  const rethinkView = document.querySelector("#rethinkView");
  const resultEyebrow = document.querySelector("#resultEyebrow");
  const resultTitle = document.querySelector("#resultTitle");
  const resultCopy = document.querySelector("#resultCopy");
  const resultEmphasis = document.querySelector("#resultEmphasis");
  const resultVisual = document.querySelector("#resultVisual");
  const analysisButton = document.querySelector("#analysisButton");
  const analysisDone = document.querySelector("#analysisDone");
  const analysisTail = document.querySelector("#analysisTail");
  const rethinkButton = document.querySelector("#rethinkButton");
  const backButton = document.querySelector("#backButton");

  let currentAnswer = null;
  let analysisOff = false;
  let recipientName = "";
  let requestSerial = 0;
  let writeQueue = Promise.resolve();

  function showOnly(view) {
    for (const item of [loadingView, questionView, resultView, rethinkView]) item.hidden = item !== view;
    view.classList.remove("is-entering");
    requestAnimationFrame(() => view.classList.add("is-entering"));
  }

  function setBusy(isBusy) {
    document.querySelectorAll("button[data-answer]").forEach((button) => {
      button.disabled = isBusy;
    });
  }

  function decorateResult(answer) {
    resultVisual.replaceChildren();
    if (answer === "good") {
      for (let i = 0; i < 7; i += 1) {
        const spark = document.createElement("span");
        spark.className = "spark";
        spark.style.left = `${12 + Math.random() * 58}px`;
        spark.style.top = `${36 + Math.random() * 26}px`;
        spark.style.setProperty("--x", `${-18 + Math.random() * 36}px`);
        spark.style.animationDelay = `${Math.random() * 260}ms`;
        resultVisual.append(spark);
      }
    } else if (answer === "unsure") {
      const ring = document.createElement("span");
      ring.className = "unsure-ring";
      resultVisual.append(ring);
    } else if (answer === "bad") {
      const glow = document.createElement("span");
      glow.className = "bad-glow";
      resultVisual.append(glow);
    }
  }

  function renderResult(answer, isAnalysisOff, { animate = true } = {}) {
    const item = content[answer];
    if (!item) return renderQuestion();

    currentAnswer = answer;
    analysisOff = Boolean(isAnalysisOff);
    document.body.dataset.mood = answer;
    resultEyebrow.textContent = item.eyebrow;
    resultTitle.textContent = item.title;
    resultCopy.textContent = item.copy;
    resultEmphasis.textContent = item.emphasis;
    analysisTail.textContent = item.tail;
    analysisButton.hidden = analysisOff;
    analysisDone.hidden = !analysisOff;
    if (animate) decorateResult(answer);
    else resultVisual.replaceChildren();
    showOnly(resultView);
  }

  function renderQuestion() {
    currentAnswer = null;
    analysisOff = false;
    delete document.body.dataset.mood;
    questionTitle.textContent = recipientName
      ? `Wie lief das Gespräch, ${recipientName}?`
      : "Wie lief das Gespräch?";
    showOnly(questionView);
  }

  async function sendEvent(payload) {
    const response = await fetch(`${API}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      keepalive: true
    });
    if (!response.ok) throw new Error(`Check-in API ${response.status}`);
    return response.json();
  }

  function recordInBackground(payload, serial) {
    // Events bleiben in der Klick-Reihenfolge, ohne die Animation/UI zu blockieren.
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(() => sendEvent(payload));

    writeQueue.catch((error) => {
      if (serial === requestSerial) console.error("Check-in konnte nicht gespeichert werden.", error);
    });
  }

  function selectAnswer(answer) {
    if (!content[answer]) return;
    requestSerial += 1;
    const serial = requestSerial;
    setBusy(true);

    // Die visuelle Reaktion erfolgt sofort; DB + Mail laufen unabhängig davon weiter.
    renderResult(answer, false);
    recordInBackground({ type: "answer", value: answer }, serial);

    window.setTimeout(() => setBusy(false), 450);
  }

  document.querySelectorAll("button[data-answer]").forEach((button) => {
    button.addEventListener("click", () => selectAnswer(button.dataset.answer));
  });

  analysisButton.addEventListener("click", () => {
    if (!currentAnswer || analysisOff) return;
    analysisOff = true;
    analysisButton.hidden = true;
    analysisDone.hidden = false;
    analysisDone.classList.remove("is-entering");
    requestAnimationFrame(() => analysisDone.classList.add("is-entering"));
    recordInBackground({ type: "analysis_off" }, requestSerial);
  });

  rethinkButton.addEventListener("click", () => showOnly(rethinkView));
  backButton.addEventListener("click", () => {
    if (currentAnswer) renderResult(currentAnswer, analysisOff, { animate: false });
    else renderQuestion();
  });

  async function boot() {
    try {
      const response = await fetch(API, { cache: "no-store" });
      if (!response.ok) throw new Error(`Check-in API ${response.status}`);
      const state = await response.json();
      recipientName = typeof state.recipient_name === "string" ? state.recipient_name.trim() : "";
      if (state.answer && content[state.answer]) {
        renderResult(state.answer, state.analysis_off, { animate: false });
      } else {
        renderQuestion();
      }
    } catch (error) {
      console.error("Check-in-Status konnte nicht geladen werden.", error);
      renderQuestion();
    }
  }

  boot();
})();
