(() => {
  "use strict";

  const MAX_ENTRIES = 100;
  const MAX_LABEL_LENGTH = 200;
  const UINT32_RANGE = 0x100000000;
  const TWO_PI = Math.PI * 2;

  const state = {
    mode: "wheel",
    phase: "editing",
    theme: "system",
    entries: [],
    nextId: 1,
    wheelRotation: 0,
    wheelWinnerIndex: null,
    currentRun: null,
    activeAnimation: null,
  };

  const els = {
    root: document.documentElement,
    body: document.body,
    themeMeta: document.querySelector("#theme-color-meta"),
    setup: document.querySelector("#setup-screen"),
    game: document.querySelector("#game-screen"),
    themeButtons: [...document.querySelectorAll("[data-theme-choice]")],
    modeButtons: [...document.querySelectorAll("[data-mode]")],
    input: document.querySelector("#entry-input"),
    addButton: document.querySelector("#add-button"),
    inputNotice: document.querySelector("#input-notice"),
    entryCount: document.querySelector("#entry-count"),
    entriesEmpty: document.querySelector("#entries-empty"),
    entriesList: document.querySelector("#entries-list"),
    startButton: document.querySelector("#start-button"),
    startButtonText: document.querySelector("#start-button-text"),
    startLabel: document.querySelector("#start-label"),
    startDetail: document.querySelector("#start-detail"),
    gameModeLabel: document.querySelector("#game-mode-label"),
    gameStatus: document.querySelector("#game-status"),
    gameCount: document.querySelector("#game-count"),
    wheelExperience: document.querySelector("#wheel-experience"),
    wheelWrap: document.querySelector("#wheel-wrap"),
    wheelPointer: document.querySelector(".wheel-pointer span"),
    wheelRotor: document.querySelector("#wheel-rotor"),
    wheelCanvas: document.querySelector("#wheel-canvas"),
    lpsExperience: document.querySelector("#lps-experience"),
    arena: document.querySelector("#arena"),
    effectLayer: document.querySelector("#effect-layer"),
    resultCard: document.querySelector("#result-card"),
    resultKicker: document.querySelector("#result-kicker"),
    winnerName: document.querySelector("#winner-name"),
    resultNote: document.querySelector("#result-note"),
    skipButton: document.querySelector("#skip-button"),
    resultActions: document.querySelector("#result-actions"),
    editButton: document.querySelector("#edit-button"),
    againButton: document.querySelector("#again-button"),
  };

  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  function secureRandomUint32() {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0];
  }

  function fairRandomInt(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
      throw new RangeError("maxExclusive must be a positive integer <= 2^32");
    }

    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    let value;
    do {
      value = secureRandomUint32();
    } while (value >= limit);
    return value % maxExclusive;
  }

  function fairShuffle(items) {
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = fairRandomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function visualRandom(min = 0, max = 1) {
    return min + Math.random() * (max - min);
  }

  function visualRandomInt(min, maxInclusive) {
    return Math.floor(visualRandom(min, maxInclusive + 1));
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function currentTheme() {
    if (state.theme === "system") return systemTheme.matches ? "dark" : "light";
    return state.theme;
  }

  function setTheme(choice) {
    state.theme = choice;
    if (choice === "system") {
      delete els.root.dataset.theme;
    } else {
      els.root.dataset.theme = choice;
    }

    els.themeButtons.forEach((button) => {
      const active = button.dataset.themeChoice === choice;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    updateThemeMeta();
    if (!els.wheelExperience.hidden) drawWheel(state.wheelWinnerIndex);
  }

  function updateThemeMeta() {
    els.themeMeta.setAttribute("content", currentTheme() === "dark" ? "#0f1116" : "#f4f1ea");
  }

  function setMode(mode) {
    if (state.phase === "running") return;
    state.mode = mode;
    els.modeButtons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderSetupState();
  }

  function parseInput(raw) {
    return raw
      .split(/[\n\r,]+/g)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function addEntriesFromInput() {
    const raw = els.input.value.trim();
    if (!raw) return;

    const candidates = parseInput(raw);
    const room = MAX_ENTRIES - state.entries.length;
    let skippedLong = 0;
    let skippedLimit = 0;

    const accepted = [];
    for (const label of candidates) {
      if (label.length > MAX_LABEL_LENGTH) {
        skippedLong += 1;
        continue;
      }
      if (accepted.length >= room) {
        skippedLimit += 1;
        continue;
      }
      accepted.push(label);
    }

    accepted.forEach((label) => {
      state.entries.push({ id: state.nextId++, label });
    });

    els.input.value = "";
    els.addButton.disabled = true;

    const notices = [];
    if (skippedLong) notices.push(`${skippedLong} zu lange Option${skippedLong === 1 ? " wurde" : "en wurden"} übersprungen (max. ${MAX_LABEL_LENGTH} Zeichen).`);
    if (skippedLimit) notices.push(`Maximum von ${MAX_ENTRIES} Optionen erreicht.`);
    els.inputNotice.textContent = notices.join(" ");

    renderEntries();
    renderSetupState();
  }

  function removeEntry(id) {
    state.entries = state.entries.filter((entry) => entry.id !== id);
    renderEntries();
    renderSetupState();
  }

  function updateEntry(id, label) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    const next = label.trim().slice(0, MAX_LABEL_LENGTH);
    if (!next) return;
    entry.label = next;
  }

  function renderEntries() {
    els.entriesList.textContent = "";
    els.entriesEmpty.hidden = state.entries.length > 0;

    const fragment = document.createDocumentFragment();
    state.entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "entry-row";

      const number = document.createElement("span");
      number.className = "entry-number";
      number.textContent = String(index + 1);

      const input = document.createElement("input");
      input.className = "entry-edit";
      input.type = "text";
      input.value = entry.label;
      input.maxLength = MAX_LABEL_LENGTH;
      input.setAttribute("aria-label", `Option ${index + 1} bearbeiten`);
      input.addEventListener("input", () => updateEntry(entry.id, input.value));
      input.addEventListener("blur", () => {
        if (!input.value.trim()) {
          input.value = entry.label;
        } else {
          updateEntry(entry.id, input.value);
          input.value = entry.label;
        }
      });

      const remove = document.createElement("button");
      remove.className = "remove-entry";
      remove.type = "button";
      remove.setAttribute("aria-label", `${entry.label} entfernen`);
      remove.textContent = "×";
      remove.addEventListener("click", () => removeEntry(entry.id));

      row.append(number, input, remove);
      fragment.append(row);
    });

    els.entriesList.append(fragment);
    els.entryCount.textContent = `${state.entries.length} / ${MAX_ENTRIES}`;
  }

  function renderSetupState() {
    const ready = state.entries.length >= 2;
    els.startButton.disabled = !ready;
    els.startButtonText.textContent = state.mode === "wheel" ? "Rad drehen" : "Eliminierung starten";

    if (!ready) {
      els.startLabel.textContent = "Mindestens 2 Optionen hinzufügen";
      els.startDetail.textContent = "Nichts wird gespeichert.";
    } else {
      els.startLabel.textContent = `${state.entries.length} Option${state.entries.length === 1 ? "" : "en"} bereit`;
      els.startDetail.textContent = state.mode === "wheel" ? "Eine faire Ziehung." : "Eine faire Eliminierungsreihenfolge.";
    }
  }

  function enterGame() {
    document.activeElement?.blur?.();
    state.phase = "running";
    els.body.classList.add("is-game");
    els.setup.hidden = true;
    els.game.hidden = false;
    els.resultCard.hidden = true;
    els.resultActions.hidden = true;
    els.skipButton.hidden = true;
    els.gameModeLabel.textContent = state.mode === "wheel" ? "Decision Wheel" : "Last Person Standing";
  }

  function returnToEdit() {
    state.phase = "editing";
    state.currentRun = null;
    state.wheelWinnerIndex = null;
    if (state.activeAnimation) {
      try { state.activeAnimation.cancel(); } catch (_) {}
      state.activeAnimation = null;
    }
    els.body.classList.remove("is-game");
    els.game.hidden = true;
    els.setup.hidden = false;
    els.resultCard.hidden = true;
    els.resultActions.hidden = true;
    els.skipButton.hidden = true;
    els.wheelExperience.hidden = true;
    els.lpsExperience.hidden = true;
    els.effectLayer.replaceChildren();
  }

  function getWheelPalette() {
    const styles = getComputedStyle(els.root);
    return Array.from({ length: 8 }, (_, index) => styles.getPropertyValue(`--wheel-${index + 1}`).trim());
  }

  function getDisplayLabel(label, count, index) {
    const clean = label.trim();
    if (count <= 8) return truncate(clean, 18);
    if (count <= 16) return truncate(clean, 12);
    if (count <= 24) return truncate(clean, 8);
    if (count <= 36) return initials(clean, 3) || truncate(clean, 5);
    if (count <= 48) return initials(clean, 2) || String(index + 1);
    return String(index + 1);
  }

  function truncate(value, length) {
    if (value.length <= length) return value;
    return `${value.slice(0, Math.max(1, length - 1))}…`;
  }

  function initials(value, max = 2) {
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, max).map((part) => part[0]).join("").toUpperCase();
    return value.slice(0, max).toUpperCase();
  }

  function drawWheel(highlightIndex = null, highlightStrength = 1) {
    if (els.wheelExperience.hidden || !state.entries.length) return;

    const canvas = els.wheelCanvas;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.floor(Math.min(rect.width, rect.height) * dpr);
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.scale(dpr, dpr);

    const cssSize = size / dpr;
    const center = cssSize / 2;
    // Leave a little breathing room so the winner can physically lift toward
    // the rim instead of looking inset into the wheel.
    const radius = center - Math.max(8, cssSize * 0.022);
    const count = state.entries.length;
    const arc = TWO_PI / count;
    const palette = getWheelPalette();
    const ink = getComputedStyle(els.root).getPropertyValue("--ink").trim();
    const surface = getComputedStyle(els.root).getPropertyValue("--surface-strong").trim();
    const strength = highlightIndex === null ? 0 : Math.max(0, highlightStrength);
    const indices = state.entries.map((_, index) => index);

    // Paint the winner last so its lifted edge and shadow sit on top of its
    // neighbours rather than being covered by the next segment.
    if (highlightIndex !== null && indices.includes(highlightIndex)) {
      indices.splice(indices.indexOf(highlightIndex), 1);
      indices.push(highlightIndex);
    }

    indices.forEach((index) => {
      const entry = state.entries[index];
      const start = -Math.PI / 2 + index * arc;
      const end = start + arc;
      const mid = start + arc / 2;
      const highlighted = highlightIndex === index;
      const dimmed = highlightIndex !== null && !highlighted;
      const lift = highlighted ? Math.max(4, cssSize * 0.014) * strength : 0;
      const radiusBoost = highlighted ? Math.max(3, cssSize * 0.009) * strength : 0;
      const drawRadius = radius + radiusBoost;
      const liftX = Math.cos(mid) * lift;
      const liftY = Math.sin(mid) * lift;

      ctx.save();
      ctx.translate(liftX, liftY);
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, drawRadius, start, end);
      ctx.closePath();
      ctx.globalAlpha = dimmed ? Math.max(0.44, 1 - 0.54 * Math.min(1, strength)) : 1;
      ctx.fillStyle = palette[index % palette.length];

      if (highlighted && strength > 0) {
        ctx.shadowBlur = Math.max(14, cssSize * 0.045) * Math.min(1, strength);
        ctx.shadowOffsetY = Math.max(4, cssSize * 0.012) * Math.min(1, strength);
        ctx.shadowColor = currentTheme() === "dark" ? "rgba(0,0,0,.72)" : "rgba(32,26,22,.30)";
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.globalAlpha = highlighted ? 0.56 : 0.26;
      ctx.strokeStyle = surface;
      ctx.lineWidth = highlighted
        ? Math.max(2, cssSize * 0.007)
        : Math.max(1, Math.min(2, 10 / count));
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (count <= 60) {
        const label = getDisplayLabel(entry.label, count, index);
        const labelRadius = count <= 8 ? drawRadius * 0.64 : drawRadius * 0.70;
        let fontSize;
        if (count <= 8) fontSize = Math.max(11, cssSize * 0.043);
        else if (count <= 16) fontSize = Math.max(9, cssSize * 0.030);
        else if (count <= 30) fontSize = Math.max(8, cssSize * 0.023);
        else fontSize = Math.max(7, cssSize * 0.018);
        if (highlighted) fontSize *= 1 + 0.07 * Math.min(1, strength);

        ctx.save();
        ctx.translate(center + Math.cos(mid) * labelRadius, center + Math.sin(mid) * labelRadius);
        ctx.rotate(mid + Math.PI / 2);
        if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) ctx.rotate(Math.PI);
        ctx.fillStyle = currentTheme() === "dark" ? "#ffffff" : "#111218";
        ctx.globalAlpha = dimmed ? 0.48 : 0.94;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }

      ctx.restore();
    });

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.13, 0, TWO_PI);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.12;
    ctx.stroke();
  }

  function animateWheelWinnerPop(winnerIndex) {
    return new Promise((resolve) => {
      const duration = 520;
      const startedAt = performance.now();

      function frame(now) {
        const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const softOvershoot = Math.sin(progress * Math.PI) * 0.10 * (1 - progress * 0.25);
        drawWheel(winnerIndex, easeOut + softOvershoot);

        if (progress < 1) {
          window.requestAnimationFrame(frame);
        } else {
          drawWheel(winnerIndex, 1);
          resolve();
        }
      }

      window.requestAnimationFrame(frame);
    });
  }

  function normalizeAngle(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function buildSpinPlan(startRotation, targetRotation) {
    const distance = targetRotation - startRotation;

    // A power-based ease-out gives us a continuous angular velocity that can
    // only decrease. Values around 2 resemble a wheel slowing under friction;
    // varying the exponent changes how early or late the braking becomes visible
    // without ever accelerating the wheel again.
    const brakeExponent = visualRandom(1.82, 2.38);
    const desiredInitialRps = visualRandom(2.15, 3.05);
    const desiredInitialVelocity = desiredInitialRps * TWO_PI;
    const calculatedDuration = (distance * brakeExponent / desiredInitialVelocity) * 1000;
    const duration = Math.round(Math.min(8600, Math.max(5200, calculatedDuration)));

    return { duration, brakeExponent };
  }

  function pulseWheelPointer() {
    if (!els.wheelPointer) return;
    try {
      els.wheelPointer.getAnimations().forEach((animation) => animation.cancel());
    } catch (_) {}

    els.wheelPointer.animate([
      { transform: "rotate(0deg)" },
      { offset: 0.34, transform: "rotate(5deg)" },
      { offset: 0.70, transform: "rotate(-1.5deg)" },
      { transform: "rotate(0deg)" },
    ], {
      duration: 115,
      easing: "cubic-bezier(.22,.78,.28,1)",
    });
  }

  function animateWheelRotation(startRotation, targetRotation, duration, brakeExponent, segmentArc) {
    const distance = targetRotation - startRotation;

    return new Promise((resolve) => {
      let rafId = 0;
      let settled = false;
      let lastBoundary = Math.floor(startRotation / segmentArc);
      let lastPointerPulseAt = -Infinity;

      const control = {
        startedAt: performance.now(),
        duration,
        cancel() {
          if (settled) return;
          settled = true;
          window.cancelAnimationFrame(rafId);
          resolve(false);
        },
        finish() {
          if (settled) return;
          settled = true;
          window.cancelAnimationFrame(rafId);
          els.wheelRotor.style.transform = `rotate(${targetRotation}rad)`;
          resolve(true);
        },
      };

      state.activeAnimation = control;

      function frame(now) {
        if (settled) return;

        const elapsed = now - control.startedAt;
        const timeProgress = Math.min(1, Math.max(0, elapsed / duration));
        const motionProgress = 1 - Math.pow(1 - timeProgress, brakeExponent);
        const rotation = startRotation + distance * motionProgress;

        els.wheelRotor.style.transform = `rotate(${rotation}rad)`;

        const boundary = Math.floor(rotation / segmentArc);
        if (boundary !== lastBoundary && now - lastPointerPulseAt >= 72) {
          lastBoundary = boundary;
          lastPointerPulseAt = now;
          pulseWheelPointer();
        }

        if (timeProgress >= 1) {
          settled = true;
          els.wheelRotor.style.transform = `rotate(${targetRotation}rad)`;
          resolve(true);
          return;
        }

        rafId = window.requestAnimationFrame(frame);
      }

      rafId = window.requestAnimationFrame(frame);
    });
  }

  async function runWheel() {
    enterGame();
    els.wheelExperience.hidden = false;
    els.lpsExperience.hidden = true;
    els.gameStatus.textContent = "Das Rad dreht sich…";
    els.gameCount.textContent = `${state.entries.length} Optionen`;
    els.againButton.innerHTML = 'Nochmal drehen <span aria-hidden="true">↻</span>';

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const winnerIndex = fairRandomInt(state.entries.length);
    state.wheelWinnerIndex = winnerIndex;
    const winner = state.entries[winnerIndex];
    const arc = TWO_PI / state.entries.length;
    const safeOffset = visualRandom(-0.30, 0.30) * arc;
    const desiredModulo = normalizeAngle(-(winnerIndex + 0.5) * arc + safeOffset);
    const currentModulo = normalizeAngle(state.wheelRotation);
    const deltaToTarget = normalizeAngle(desiredModulo - currentModulo);
    const extraTurns = visualRandomInt(7, 11);
    const targetRotation = state.wheelRotation + extraTurns * TWO_PI + deltaToTarget;
    const { duration, brakeExponent } = buildSpinPlan(state.wheelRotation, targetRotation);

    drawWheel(null);

    const completed = await animateWheelRotation(
      state.wheelRotation,
      targetRotation,
      duration,
      brakeExponent,
      arc,
    );
    if (!completed) return;

    state.activeAnimation = null;
    state.wheelRotation = normalizeAngle(targetRotation);
    els.wheelRotor.style.transform = `rotate(${state.wheelRotation}rad)`;
    els.gameStatus.textContent = "Entschieden.";

    await animateWheelWinnerPop(winnerIndex);
    await sleep(240);
    showResult(winner, "Gewinner", "Jeder neue Spin ist eine unabhängige Ziehung.");
  }

  function cardAccent(index) {
    const palette = getWheelPalette();
    return palette[index % palette.length];
  }

  function lpsLabel(entry, remaining, index) {
    if (remaining > 70) return String(index + 1);
    if (remaining > 44) return initials(entry.label, 2) || String(index + 1);
    if (remaining > 24) return truncate(entry.label, 6);
    if (remaining > 12) return truncate(entry.label, 10);
    if (remaining > 6) return truncate(entry.label, 18);
    return entry.label;
  }

  function arenaLayout(count) {
    const rect = els.arena.getBoundingClientRect();
    const aspect = Math.max(0.5, rect.width / Math.max(1, rect.height));
    let cols = Math.ceil(Math.sqrt(count * aspect));
    cols = Math.max(1, Math.min(count, cols));
    const rows = Math.ceil(count / cols);
    return { cols, rows };
  }

  function arenaDensity(count) {
    if (count > 60) return "density-extreme";
    if (count > 30) return "density-high";
    if (count > 10) return "density-medium";
    if (count > 2) return "density-low";
    return "density-final";
  }

  function renderArena(aliveIds, finalMode = false) {
    const aliveSet = new Set(aliveIds);
    const aliveEntries = state.entries.filter((entry) => aliveSet.has(entry.id));
    const { cols, rows } = arenaLayout(aliveEntries.length);

    els.arena.style.setProperty("--arena-cols", cols);
    els.arena.style.setProperty("--arena-rows", rows);
    els.arena.className = `arena ${finalMode ? "density-final" : arenaDensity(aliveEntries.length)}`;
    els.arena.textContent = "";

    const fragment = document.createDocumentFragment();
    aliveEntries.forEach((entry) => {
      const originalIndex = state.entries.findIndex((item) => item.id === entry.id);
      const card = document.createElement("div");
      card.className = "contender-card";
      card.dataset.id = String(entry.id);
      card.style.setProperty("--card-accent", cardAccent(originalIndex));

      const index = document.createElement("span");
      index.className = "contender-index";
      index.textContent = String(originalIndex + 1);

      const avatar = document.createElement("span");
      avatar.className = "contender-avatar";
      avatar.textContent = initials(entry.label, aliveEntries.length > 30 ? 1 : 2) || String(originalIndex + 1);

      const name = document.createElement("span");
      name.className = "contender-name";
      name.textContent = lpsLabel(entry, aliveEntries.length, originalIndex);

      card.append(index, avatar, name);
      fragment.append(card);
    });
    els.arena.append(fragment);
  }

  function aliveIdsForRun(run) {
    return run.order.slice(run.eliminatedCount).map((entry) => entry.id);
  }

  function chooseBatchSize(remaining) {
    if (remaining > 80) return Math.min(visualRandomInt(6, 10), remaining - 2);
    if (remaining > 60) return Math.min(visualRandomInt(4, 8), remaining - 2);
    if (remaining > 40) return Math.min(visualRandomInt(3, 6), remaining - 2);
    if (remaining > 20) return Math.min(visualRandomInt(2, 4), remaining - 2);
    if (remaining > 10) return Math.min(visualRandomInt(1, 2), remaining - 2);
    return 1;
  }

  function chooseSimpleEffect() {
    const effects = ["fade", "collapse", "drop", "knockout", "impact", "cut"];
    return effects[visualRandomInt(0, effects.length - 1)];
  }

  function chooseSingleEffect(remaining) {
    const effects = ["fade", "collapse", "drop", "knockout", "impact", "cut"];
    if (remaining <= 18) effects.push("duel");
    if (remaining <= 12) effects.push("shredder", "burn");
    return effects[visualRandomInt(0, effects.length - 1)];
  }

  async function animateSimpleExit(card, effect) {
    if (!card) return;
    card.classList.add("is-focus");
    await sleep(120);

    if (effect === "cut") {
      const line = document.createElement("span");
      line.className = "cut-line";
      card.append(line);
    }

    if (effect === "burn") {
      const overlay = document.createElement("span");
      overlay.className = "burn-overlay";
      card.append(overlay);
      for (let i = 0; i < 8; i += 1) {
        const ember = document.createElement("span");
        ember.className = "ember";
        ember.style.left = `${visualRandom(15, 85)}%`;
        ember.style.bottom = `${visualRandom(4, 28)}%`;
        ember.style.setProperty("--ember-time", `${visualRandomInt(540, 920)}ms`);
        ember.style.setProperty("--ember-x", `${visualRandomInt(-28, 28)}px`);
        card.append(ember);
      }
    }

    card.classList.add(`eliminate-${effect}`);
    const duration = effect === "burn" ? 1080 : effect === "cut" ? 620 : 610;
    await sleep(duration);
  }

  async function animateShredder(card) {
    if (!card) return;
    const layerRect = els.effectLayer.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    card.style.visibility = "hidden";

    const left = rect.left - layerRect.left;
    const top = rect.top - layerRect.top;
    const mouthTop = rect.bottom - layerRect.top - 7;

    const clone = card.cloneNode(true);
    clone.className = "contender-card effect-clone";
    Object.assign(clone.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      visibility: "visible",
      zIndex: "2",
      transformOrigin: "50% 100%",
      willChange: "transform, opacity, clip-path",
    });

    const mouth = document.createElement("div");
    mouth.className = "shredder-mouth";
    Object.assign(mouth.style, {
      left: `${left - 7}px`,
      top: `${mouthTop}px`,
      width: `${rect.width + 14}px`,
    });

    const cardAccentColor = getComputedStyle(card).getPropertyValue("--card-accent").trim() || cardAccent(0);
    const stripCount = Math.max(8, Math.min(12, Math.round(rect.width / 24)));
    const stripWidth = rect.width / stripCount;
    const stripNodes = [];
    const stripAnimations = [];

    els.effectLayer.append(clone, mouth);

    for (let i = 0; i < stripCount; i += 1) {
      const strip = document.createElement("span");
      strip.className = "shred-strip";
      const stripHeight = Math.max(20, rect.height * visualRandom(.28, .48));
      const driftX = visualRandomInt(-9, 9);
      const fallY = visualRandomInt(34, 58);
      const rotation = visualRandomInt(-9, 9);
      const delay = 150 + i * visualRandomInt(10, 18) + visualRandomInt(0, 36);

      Object.assign(strip.style, {
        left: `${left + i * stripWidth + 0.5}px`,
        top: `${mouthTop + 8}px`,
        width: `${Math.max(3, stripWidth - 1)}px`,
        height: `${stripHeight}px`,
        opacity: "0",
        "--shred-accent": cardAccentColor,
      });
      els.effectLayer.append(strip);
      stripNodes.push(strip);

      const animation = strip.animate([
        { transform: "translate3d(0,-7px,0) scaleY(.08) rotate(0deg)", opacity: 0 },
        { offset: 0.16, transform: "translate3d(0,2px,0) scaleY(.38) rotate(0deg)", opacity: 1 },
        { offset: 0.48, transform: `translate3d(${driftX * 0.35}px,${fallY * 0.34}px,0) scaleY(.88) rotate(${rotation * 0.35}deg)`, opacity: .96 },
        { transform: `translate3d(${driftX}px,${fallY}px,0) scaleY(1) rotate(${rotation}deg)`, opacity: 0 },
      ], {
        duration: visualRandomInt(620, 820),
        delay,
        easing: "cubic-bezier(.22,.62,.3,1)",
        fill: "forwards",
      });
      stripAnimations.push(animation.finished);
    }

    const mouthAnimation = mouth.animate([
      { transform: "scaleX(.94)", filter: "brightness(.92)" },
      { offset: 0.38, transform: "scaleX(1.025)", filter: "brightness(1.08)" },
      { transform: "scaleX(1)", filter: "brightness(1)" },
    ], {
      duration: 640,
      easing: "cubic-bezier(.2,.75,.25,1)",
      fill: "forwards",
    });

    // The card is fed into the mouth while the first strips are already
    // emerging. Nothing waits for a separate "phase", which keeps the effect
    // feeling like one continuous mechanical action.
    const feedAnimation = clone.animate([
      { transform: "translate3d(0,0,0) scale(1)", clipPath: "inset(0 0 0 0)", opacity: 1 },
      { offset: 0.28, transform: "translate3d(0,7px,0) scale(.997)", clipPath: "inset(0 0 5% 0)", opacity: 1 },
      { offset: 0.55, transform: "translate3d(0,16px,0) scale(.99)", clipPath: "inset(0 0 32% 0)", opacity: 1 },
      { offset: 0.80, transform: "translate3d(0,25px,0) scale(.98)", clipPath: "inset(0 0 72% 0)", opacity: .92 },
      { transform: "translate3d(0,31px,0) scale(.97)", clipPath: "inset(0 0 100% 0)", opacity: .22 },
    ], {
      duration: 900,
      easing: "cubic-bezier(.32,.08,.58,1)",
      fill: "forwards",
    });

    await Promise.allSettled([
      feedAnimation.finished,
      mouthAnimation.finished,
      ...stripAnimations,
    ]);

    clone.remove();
    mouth.remove();
    stripNodes.forEach((strip) => strip.remove());
  }

  async function animateDuel(targetCard, opponentCard) {
    if (!targetCard || !opponentCard) return animateSimpleExit(targetCard, "knockout");

    const layerRect = els.effectLayer.getBoundingClientRect();
    const targetRect = targetCard.getBoundingClientRect();
    const opponentRect = opponentCard.getBoundingClientRect();
    targetCard.style.visibility = "hidden";
    opponentCard.style.visibility = "hidden";

    const targetClone = targetCard.cloneNode(true);
    const opponentClone = opponentCard.cloneNode(true);
    [targetClone, opponentClone].forEach((clone) => clone.classList.add("effect-clone"));

    Object.assign(targetClone.style, {
      left: `${targetRect.left - layerRect.left}px`,
      top: `${targetRect.top - layerRect.top}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
      visibility: "visible",
    });
    Object.assign(opponentClone.style, {
      left: `${opponentRect.left - layerRect.left}px`,
      top: `${opponentRect.top - layerRect.top}px`,
      width: `${opponentRect.width}px`,
      height: `${opponentRect.height}px`,
      visibility: "visible",
    });

    els.effectLayer.append(targetClone, opponentClone);

    const targetCenter = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
    const opponentCenter = { x: opponentRect.left + opponentRect.width / 2, y: opponentRect.top + opponentRect.height / 2 };
    const mid = {
      x: (targetCenter.x + opponentCenter.x) / 2,
      y: (targetCenter.y + opponentCenter.y) / 2,
    };
    const targetDx = mid.x - targetCenter.x;
    const targetDy = mid.y - targetCenter.y;
    const opponentDx = mid.x - opponentCenter.x;
    const opponentDy = mid.y - opponentCenter.y;

    const approachTarget = targetClone.animate([
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${targetDx * .86}px, ${targetDy * .86}px) scale(1.03)` },
    ], { duration: 470, easing: "cubic-bezier(.3,.8,.3,1)", fill: "forwards" });
    const approachOpponent = opponentClone.animate([
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${opponentDx * .86}px, ${opponentDy * .86}px) scale(1.03)` },
    ], { duration: 470, easing: "cubic-bezier(.3,.8,.3,1)", fill: "forwards" });

    await Promise.all([approachTarget.finished, approachOpponent.finished]);

    const flash = document.createElement("span");
    flash.className = "duel-flash";
    flash.style.left = `${mid.x - layerRect.left}px`;
    flash.style.top = `${mid.y - layerRect.top}px`;
    els.effectLayer.append(flash);

    const vx = targetCenter.x - opponentCenter.x;
    const vy = targetCenter.y - opponentCenter.y;
    const length = Math.hypot(vx, vy) || 1;
    const outX = (vx / length) * Math.max(180, targetRect.width * 2.2);
    const outY = (vy / length) * Math.max(110, targetRect.height * 1.5);

    const targetOut = targetClone.animate([
      { transform: `translate(${targetDx * .86}px, ${targetDy * .86}px) scale(1.03)`, opacity: 1 },
      { transform: `translate(${targetDx * .86 + outX}px, ${targetDy * .86 + outY}px) rotate(${visualRandomInt(-20, 20)}deg) scale(.86)`, opacity: 0 },
    ], { duration: 560, easing: "cubic-bezier(.2,.7,.35,1)", fill: "forwards" });

    const opponentReturn = opponentClone.animate([
      { transform: `translate(${opponentDx * .86}px, ${opponentDy * .86}px) scale(1.03)` },
      { offset: .3, transform: `translate(${opponentDx * .72}px, ${opponentDy * .72}px) scale(.96)` },
      { transform: "translate(0,0) scale(1)" },
    ], { duration: 650, easing: "cubic-bezier(.2,.8,.25,1)", fill: "forwards" });

    await Promise.allSettled([targetOut.finished, opponentReturn.finished]);
    targetClone.remove();
    opponentClone.remove();
    flash.remove();
    opponentCard.style.visibility = "";
  }

  function snapshotCardPositions() {
    const positions = new Map();
    els.arena.querySelectorAll(".contender-card").forEach((card) => {
      positions.set(card.dataset.id, card.getBoundingClientRect());
    });
    return positions;
  }

  async function reflowArena(aliveIds, previousPositions, finalMode = false) {
    renderArena(aliveIds, finalMode);
    const animations = [];
    els.arena.querySelectorAll(".contender-card").forEach((card) => {
      const previous = previousPositions.get(card.dataset.id);
      if (!previous) return;
      const next = card.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      animations.push(card.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0,0)" },
      ], { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }).finished);
    });
    await Promise.allSettled(animations);
  }

  async function eliminateBatch(run, batch) {
    const remainingBefore = run.order.length - run.eliminatedCount;
    const batchIds = new Set(batch.map((entry) => entry.id));
    const oldPositions = snapshotCardPositions();

    if (batch.length > 1) {
      const jobs = batch.map(async (entry, index) => {
        await sleep(index * visualRandomInt(55, 125));
        const card = els.arena.querySelector(`[data-id="${entry.id}"]`);
        await animateSimpleExit(card, chooseSimpleEffect());
      });
      await Promise.all(jobs);
    } else {
      const entry = batch[0];
      const card = els.arena.querySelector(`[data-id="${entry.id}"]`);
      const effect = chooseSingleEffect(remainingBefore);

      if (effect === "duel") {
        const possibleOpponents = aliveIdsForRun(run)
          .filter((id) => id !== entry.id && !batchIds.has(id))
          .map((id) => els.arena.querySelector(`[data-id="${id}"]`))
          .filter(Boolean);
        const opponent = possibleOpponents.length ? possibleOpponents[visualRandomInt(0, possibleOpponents.length - 1)] : null;
        await animateDuel(card, opponent);
      } else if (effect === "shredder") {
        await animateShredder(card);
      } else {
        await animateSimpleExit(card, effect);
      }
    }

    run.eliminatedCount += batch.length;
    const aliveIds = aliveIdsForRun(run);
    await reflowArena(aliveIds, oldPositions, aliveIds.length <= 3);
  }

  async function runFinale(run) {
    const aliveIds = aliveIdsForRun(run);
    if (aliveIds.length !== 2) return;

    renderArena(aliveIds, true);
    els.gameStatus.textContent = "Die letzten zwei.";
    els.gameCount.textContent = "2 übrig";
    els.skipButton.hidden = true;

    const cards = [...els.arena.querySelectorAll(".contender-card")];
    cards.forEach((card) => card.classList.add("is-finalist"));
    await sleep(700);

    if (run.skip) {
      await revealLpsWinner(run);
      return;
    }

    const loser = run.order[run.eliminatedCount];
    const winner = run.order[run.order.length - 1];
    const loserCard = els.arena.querySelector(`[data-id="${loser.id}"]`);
    const winnerCard = els.arena.querySelector(`[data-id="${winner.id}"]`);
    await animateDuel(loserCard, winnerCard);
    run.eliminatedCount += 1;

    renderArena([winner.id], true);
    const finalWinnerCard = els.arena.querySelector(`[data-id="${winner.id}"]`);
    finalWinnerCard?.classList.add("is-winner");
    els.gameStatus.textContent = "Nur einer bleibt.";
    els.gameCount.textContent = "1 übrig";
    await sleep(760);
    showResult(winner, "Last Person Standing", "Die vollständige Eliminierungsreihenfolge stand bereits vor der ersten Animation fest.");
  }

  async function revealLpsWinner(run, compactReveal = true) {
    const winner = run.order[run.order.length - 1];
    renderArena([winner.id], true);
    const winnerCard = els.arena.querySelector(`[data-id="${winner.id}"]`);
    winnerCard?.classList.add("is-winner");
    els.gameStatus.textContent = "Nur einer bleibt.";
    els.gameCount.textContent = "1 übrig";
    els.skipButton.hidden = true;
    if (compactReveal) await sleep(380);
    showResult(winner, "Last Person Standing", "Die vollständige Eliminierungsreihenfolge stand bereits vor der ersten Animation fest.");
  }

  async function runLps() {
    enterGame();
    els.wheelExperience.hidden = true;
    els.lpsExperience.hidden = false;
    els.gameStatus.textContent = "Eliminierung läuft…";
    els.gameCount.textContent = `${state.entries.length} übrig`;
    els.skipButton.hidden = false;
    els.againButton.innerHTML = 'Nochmal spielen <span aria-hidden="true">↻</span>';

    const run = {
      order: fairShuffle(state.entries),
      eliminatedCount: 0,
      skip: false,
    };
    state.currentRun = run;

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    renderArena(aliveIdsForRun(run));
    await sleep(520);

    while (run.order.length - run.eliminatedCount > 2) {
      if (run.skip) {
        await revealLpsWinner(run);
        return;
      }

      const remaining = run.order.length - run.eliminatedCount;
      if (remaining === 3) {
        els.gameStatus.textContent = "Die letzten drei.";
        renderArena(aliveIdsForRun(run), true);
        await sleep(520);
      }
      const batchSize = chooseBatchSize(remaining);
      const batch = run.order.slice(run.eliminatedCount, run.eliminatedCount + batchSize);
      await eliminateBatch(run, batch);

      const nowRemaining = run.order.length - run.eliminatedCount;
      els.gameCount.textContent = `${nowRemaining} übrig`;
      els.gameStatus.textContent = nowRemaining <= 5 ? "Es wird knapp." : "Eliminierung läuft…";

      if (nowRemaining > 20) await sleep(90);
      else if (nowRemaining > 10) await sleep(180);
      else if (nowRemaining > 5) await sleep(360);
      else await sleep(620);
    }

    if (run.skip) {
      await revealLpsWinner(run);
      return;
    }

    await runFinale(run);
  }

  function fitWinnerText() {
    const element = els.winnerName;
    element.style.fontSize = "";
    const maxHeight = element.clientHeight || parseFloat(getComputedStyle(element).maxHeight) || 200;
    let size = parseFloat(getComputedStyle(element).fontSize);
    let guard = 0;
    while (element.scrollHeight > maxHeight && size > 20 && guard < 18) {
      size -= 2;
      element.style.fontSize = `${size}px`;
      guard += 1;
    }
  }

  function showResult(entry, kicker, note) {
    state.phase = "result";
    els.skipButton.hidden = true;
    els.resultKicker.textContent = kicker;
    els.winnerName.textContent = entry.label;
    els.resultNote.textContent = note;
    els.resultCard.hidden = false;
    els.resultActions.hidden = false;
    requestAnimationFrame(fitWinnerText);
  }

  async function startRun() {
    if (state.phase === "running" || state.entries.length < 2) return;
    els.inputNotice.textContent = "";
    if (state.mode === "wheel") await runWheel();
    else await runLps();
  }

  async function playAgain() {
    if (state.phase !== "result") return;
    els.resultCard.hidden = true;
    els.resultActions.hidden = true;
    els.effectLayer.replaceChildren();
    state.phase = "editing";
    if (state.mode === "wheel") await runWheel();
    else await runLps();
  }

  function handleSkip() {
    if (state.mode !== "lps" || state.phase !== "running" || !state.currentRun) return;
    state.currentRun.skip = true;
    els.skipButton.disabled = true;
    els.skipButton.textContent = "Gewinner wird angezeigt…";
  }

  function resetSkipButton() {
    els.skipButton.disabled = false;
    els.skipButton.textContent = "Direkt zum Gewinner";
  }

  function handleVisibilityChange() {
    if (document.hidden) return;
    if (state.mode === "wheel" && state.phase === "running" && state.activeAnimation) {
      const elapsed = performance.now() - state.activeAnimation.startedAt;
      if (elapsed >= state.activeAnimation.duration) {
        try { state.activeAnimation.finish(); } catch (_) {}
      }
    }
  }

  function handleResize() {
    if (!els.wheelExperience.hidden) drawWheel(state.wheelWinnerIndex);
    if (!els.lpsExperience.hidden && state.currentRun && state.phase !== "result") {
      renderArena(aliveIdsForRun(state.currentRun), aliveIdsForRun(state.currentRun).length <= 2);
    }
  }

  els.themeButtons.forEach((button) => button.addEventListener("click", () => setTheme(button.dataset.themeChoice)));
  els.modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

  els.input.addEventListener("input", () => {
    els.addButton.disabled = !els.input.value.trim() || state.entries.length >= MAX_ENTRIES;
    if (els.inputNotice.textContent) els.inputNotice.textContent = "";
  });

  els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      addEntriesFromInput();
    }
  });

  els.addButton.addEventListener("click", addEntriesFromInput);
  els.startButton.addEventListener("click", startRun);
  els.skipButton.addEventListener("click", handleSkip);
  els.editButton.addEventListener("click", () => {
    resetSkipButton();
    returnToEdit();
  });
  els.againButton.addEventListener("click", async () => {
    resetSkipButton();
    await playAgain();
  });

  systemTheme.addEventListener("change", () => {
    if (state.theme === "system") {
      updateThemeMeta();
      if (!els.wheelExperience.hidden) drawWheel(state.wheelWinnerIndex);
    }
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("resize", handleResize, { passive: true });

  const effectNames = ["fade", "collapse", "drop", "knockout", "impact", "cut", "duel", "shredder", "burn"];

  async function previewEffects(requested) {
    if (state.phase === "running") return false;
    const effects = requested === "all" ? effectNames.slice() : [requested];
    if (effects.some((name) => !effectNames.includes(name))) {
      throw new Error(`Unknown effect. Use one of: ${effectNames.join(", ")}`);
    }

    const backup = {
      entries: state.entries,
      nextId: state.nextId,
      mode: state.mode,
      phase: state.phase,
    };

    state.entries = [
      { id: -1, label: "Target" },
      { id: -2, label: "Opponent" },
      { id: -3, label: "Nova" },
      { id: -4, label: "Orion" },
    ];
    state.mode = "lps";
    enterGame();
    els.wheelExperience.hidden = true;
    els.lpsExperience.hidden = false;
    els.skipButton.hidden = true;
    els.resultActions.hidden = true;
    els.resultCard.hidden = true;

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      for (const effect of effects) {
        els.effectLayer.replaceChildren();
        renderArena(state.entries.map((entry) => entry.id), true);
        els.gameStatus.textContent = `Effektvorschau: ${effect}`;
        els.gameCount.textContent = `${effects.indexOf(effect) + 1} / ${effects.length}`;
        await sleep(520);

        const target = els.arena.querySelector('[data-id="-1"]');
        if (effect === "duel") {
          const opponent = els.arena.querySelector('[data-id="-2"]');
          await animateDuel(target, opponent);
        } else if (effect === "shredder") {
          await animateShredder(target);
        } else {
          await animateSimpleExit(target, effect);
        }
        await sleep(430);
      }
    } finally {
      state.entries = backup.entries;
      state.nextId = backup.nextId;
      state.mode = backup.mode;
      state.phase = "editing";
      returnToEdit();
      setMode(backup.mode);
      renderEntries();
      renderSetupState();
    }
    return true;
  }

  // Developer-only visual review hook. It is intentionally absent from the UI.
  // Console examples: DecideEffects.preview("burn") or DecideEffects.previewAll().
  // It never participates in fair winner/elimination selection.
  window.DecideEffects = {
    names: effectNames.slice(),
    preview: (name) => previewEffects(name),
    previewAll: () => previewEffects("all"),
  };

  renderEntries();
  renderSetupState();
  setTheme("system");
})();
