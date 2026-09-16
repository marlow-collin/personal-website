(() => {
  "use strict";

  const SLUG = "und-wie-wars";
  const BASE = `/x/admin3/api/checkins/${SLUG}`;
  const labels = {
    good: "Ziemlich gut ✨",
    unsure: "Ehrlich? Keine Ahnung.",
    bad: "Eher nicht so."
  };

  const loading = document.querySelector("#loading");
  const content = document.querySelector("#content");
  const notice = document.querySelector("#notice");
  const refreshButton = document.querySelector("#refreshButton");
  const title = document.querySelector("#title");
  const slug = document.querySelector("#slug");
  const answer = document.querySelector("#answer");
  const analysis = document.querySelector("#analysis");
  const eventCount = document.querySelector("#eventCount");
  const mailSwitch = document.querySelector("#mailSwitch");
  const mailHelp = document.querySelector("#mailHelp");
  const nameForm = document.querySelector("#nameForm");
  const recipientNameInput = document.querySelector("#recipientName");
  const saveNameButton = document.querySelector("#saveNameButton");
  const timeline = document.querySelector("#timeline");
  const resetButton = document.querySelector("#resetButton");
  const resetDialog = document.querySelector("#resetDialog");
  const confirmResetButton = document.querySelector("#confirmResetButton");

  let current = null;
  let noticeTimer = null;

  function showNotice(message, kind = "success") {
    window.clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.dataset.kind = kind;
    notice.hidden = false;
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 3600);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data;
  }

  function formatTime(value) {
    if (!value) return "—";
    const normalized = /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin"
    }).format(date);
  }

  function eventText(event) {
    if (event.type === "answer") {
      return {
        title: labels[event.value] || event.value || "Antwort",
        sub: "Antwort ausgewählt"
      };
    }
    if (event.type === "analysis_off") {
      return {
        title: "Analysemodus ausgeschaltet",
        sub: event.value && labels[event.value] ? `nach „${labels[event.value]}“` : ""
      };
    }
    return { title: event.type, sub: event.value || "" };
  }

  function render(data) {
    current = data;
    const checkin = data.checkin;
    title.textContent = checkin.title;
    slug.textContent = checkin.slug;
    if (document.activeElement !== recipientNameInput) {
      recipientNameInput.value = checkin.recipient_name || "";
    }

    if (checkin.answer) {
      answer.textContent = labels[checkin.answer] || checkin.answer;
      answer.dataset.answer = checkin.answer;
      analysis.textContent = `Analysemodus: ${checkin.analysis_off ? "aus ✓" : "an"}`;
    } else {
      answer.textContent = "Noch keine Antwort";
      delete answer.dataset.answer;
      analysis.textContent = "Analysemodus: —";
    }

    eventCount.textContent = `${checkin.event_count} ${checkin.event_count === 1 ? "Ereignis" : "Ereignisse"}`;
    mailSwitch.setAttribute("aria-checked", checkin.mail_on_next_answer ? "true" : "false");
    mailSwitch.disabled = Boolean(checkin.mail_pending);
    mailHelp.textContent = checkin.mail_pending
      ? "Die ausgelöste E-Mail wird gerade im Hintergrund verschickt."
      : "Wird nach der nächsten Antwort automatisch deaktiviert.";

    timeline.replaceChildren();
    if (!data.events.length) {
      const empty = document.createElement("div");
      empty.className = "timeline-empty";
      empty.textContent = "Noch keine Ereignisse.";
      timeline.append(empty);
    } else {
      for (const event of data.events) {
        const text = eventText(event);
        const row = document.createElement("div");
        row.className = "timeline-item";
        row.dataset.type = event.type;

        const dot = document.createElement("span");
        dot.className = "timeline-dot";
        dot.setAttribute("aria-hidden", "true");

        const copy = document.createElement("div");
        const heading = document.createElement("div");
        heading.className = "timeline-title";
        heading.textContent = text.title;
        const sub = document.createElement("div");
        sub.className = "timeline-sub";
        sub.textContent = text.sub;
        copy.append(heading, sub);

        const time = document.createElement("time");
        time.className = "timeline-time";
        time.textContent = formatTime(event.created_at);

        row.append(dot, copy, time);
        timeline.append(row);
      }
    }
  }

  async function load({ quiet = false } = {}) {
    if (!quiet) {
      loading.hidden = false;
      content.hidden = true;
    }
    try {
      const data = await request(BASE);
      render(data);
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      loading.textContent = `Fehler: ${error.message}`;
      loading.hidden = false;
      content.hidden = true;
      if (quiet) showNotice(error.message, "error");
    }
  }

  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    await load({ quiet: true });
    refreshButton.disabled = false;
  });

  nameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current || saveNameButton.disabled) return;

    const name = recipientNameInput.value.trim();
    saveNameButton.disabled = true;
    recipientNameInput.disabled = true;
    try {
      const data = await request(`${BASE}/recipient-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      recipientNameInput.value = data.recipient_name || "";
      showNotice(data.recipient_name ? `Vorname „${data.recipient_name}“ gespeichert.` : "Vorname entfernt.");
      await load({ quiet: true });
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      saveNameButton.disabled = false;
      recipientNameInput.disabled = false;
    }
  });

  mailSwitch.addEventListener("click", async () => {
    if (!current || mailSwitch.disabled) return;
    const enabled = mailSwitch.getAttribute("aria-checked") !== "true";
    mailSwitch.disabled = true;
    try {
      await request(`${BASE}/mail-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      mailSwitch.setAttribute("aria-checked", enabled ? "true" : "false");
      showNotice(enabled ? "E-Mail bei der nächsten Antwort ist aktiviert." : "E-Mail-Auslösung ist deaktiviert.");
      await load({ quiet: true });
    } catch (error) {
      showNotice(error.message, "error");
      await load({ quiet: true });
    } finally {
      mailSwitch.disabled = false;
    }
  });

  resetButton.addEventListener("click", () => {
    resetDialog.returnValue = "";
    resetDialog.showModal();
  });

  window.addEventListener("focus", () => {
    if (!content.hidden) load({ quiet: true });
  });

  resetDialog.addEventListener("close", async () => {
    if (resetDialog.returnValue !== "confirm") return;
    confirmResetButton.disabled = true;
    resetButton.disabled = true;
    try {
      await request(`${BASE}/reset`, { method: "POST" });
      showNotice("Check-in und kompletter Verlauf wurden zurückgesetzt.");
      await load({ quiet: true });
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      confirmResetButton.disabled = false;
      resetButton.disabled = false;
    }
  });

  load();
})();
