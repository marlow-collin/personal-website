import { HAND_RANKINGS } from "./hands-data.js";
import {
  RANKS,
  SUITS,
  analyzeDraws,
  cardLabel,
  describePartialHand,
  parseCard,
  preflopStartingScore
} from "./poker-engine.js";
import { planPokerSetup } from "./planner.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let uidCounter = 0;
const makeId = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `poker-${Date.now()}-${uidCounter += 1}`;
const formatNumber = (value) => Number(value).toLocaleString("de-DE", { maximumFractionDigits: 0 });
const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(1).replace(".", ",")} %`;

function suitMeta(card) {
  const parsed = parseCard(card);
  return parsed ? SUITS.find((suit) => suit.key === parsed.suit) : null;
}

function renderMiniCard(card) {
  const parsed = parseCard(card);
  const suit = suitMeta(card);
  return `<span class="mini-card ${suit?.color === "red" ? "red" : ""}" aria-label="${parsed?.rank || ""} ${suit?.name || ""}">${parsed?.rank || ""}<br>${suit?.symbol || ""}</span>`;
}

function renderRankings() {
  $("#ranking-list").innerHTML = HAND_RANKINGS.map((hand) => `
    <article class="hand-rank-card">
      <div class="rank-number">${hand.rank}</div>
      <div>
        <div class="hand-card-head">
          <div><h3>${hand.name}</h3><small>${hand.strength}</small></div>
        </div>
        <div class="mini-cards">${hand.example.map(renderMiniCard).join("")}</div>
        <div class="hand-explanation">
          <p>${hand.build}</p>
          <p><strong>Tie-Break:</strong> ${hand.tie}</p>
        </div>
      </div>
    </article>
  `).join("");
}

function activateTab(tab) {
  $$(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === tab;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

$$(".nav-item").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));

// SETUP ---------------------------------------------------------------------
const chipPalette = ["#e9e6dc", "#c83e46", "#315d9a", "#2e7c51", "#292e2b", "#d4a52c", "#7d52a8"];
let chipRows = [25, 100, 500, 1000, 5000].map((value, index) => ({
  id: makeId(),
  color: chipPalette[index],
  value: String(value),
  count: ""
}));
let blindMode = "time";

function syncChipRowsFromDom() {
  const rows = $$(".chip-row", $("#chip-editor"));
  for (const row of rows) {
    const item = chipRows.find((chip) => chip.id === row.dataset.id);
    if (!item) continue;
    item.color = $(".chip-color", row).value;
    item.value = $(".chip-value", row).value;
    item.count = $(".chip-count", row).value;
  }
}

function renderChipEditor() {
  const editor = $("#chip-editor");
  editor.innerHTML = chipRows.map((chip) => `
    <div class="chip-row" data-id="${chip.id}">
      <label class="chip-color-wrap" aria-label="Chipfarbe">
        <input class="chip-color" type="color" value="${chip.color}">
      </label>
      <input class="chip-value" type="number" inputmode="numeric" min="1" aria-label="Denomination" placeholder="Wert" value="${chip.value}">
      <input class="chip-count" type="number" inputmode="numeric" min="0" aria-label="Vorhandene Anzahl" placeholder="offen" value="${chip.count}">
      <button class="remove-chip" type="button" aria-label="Chipsorte entfernen" ${chipRows.length <= 1 ? "disabled" : ""}>×</button>
    </div>
  `).join("");

  $$("input", editor).forEach((input) => input.addEventListener("input", () => {
    syncChipRowsFromDom();
    calculateSetup();
  }));
  $$(".remove-chip", editor).forEach((button) => button.addEventListener("click", () => {
    syncChipRowsFromDom();
    const id = button.closest(".chip-row").dataset.id;
    chipRows = chipRows.filter((chip) => chip.id !== id);
    renderChipEditor();
    calculateSetup();
  }));
}

$("#add-chip").addEventListener("click", () => {
  syncChipRowsFromDom();
  if (chipRows.length >= 8) return;
  const previous = Number(chipRows.at(-1)?.value) || 1000;
  chipRows.push({ id: makeId(), color: chipPalette[chipRows.length % chipPalette.length], value: String(previous * 2), count: "" });
  renderChipEditor();
  calculateSetup();
});

$$("[data-blind-mode]").forEach((button) => button.addEventListener("click", () => {
  blindMode = button.dataset.blindMode;
  $$("[data-blind-mode]").forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle("is-active", active);
    candidate.setAttribute("aria-pressed", String(active));
  });
  $("#time-level-field").hidden = blindMode !== "time";
  $("#round-level-field").hidden = blindMode !== "rounds";
  calculateSetup();
}));

["#setup-players", "#setup-duration", "#setup-stack", "#setup-level-minutes", "#setup-rounds"].forEach((selector) => {
  $(selector).addEventListener("input", () => {
    if (selector === "#setup-level-minutes") updateLevelPresetState();
    calculateSetup();
  });
});

function updateLevelPresetState() {
  const value = $("#setup-level-minutes").value;
  $$("[data-level-preset]").forEach((button) => button.classList.toggle("is-active", button.dataset.levelPreset === value));
}

$$("[data-level-preset]").forEach((button) => button.addEventListener("click", () => {
  $("#setup-level-minutes").value = button.dataset.levelPreset;
  updateLevelPresetState();
  calculateSetup();
}));

function setupInput() {
  return {
    players: $("#setup-players").value,
    durationMinutes: $("#setup-duration").value,
    startingStack: $("#setup-stack").value,
    blindMode,
    levelMinutes: $("#setup-level-minutes").value,
    roundsPerLevel: $("#setup-rounds").value,
    chips: chipRows.map((chip) => ({ ...chip }))
  };
}

function calculateSetup() {
  syncChipRowsFromDom();
  const plan = planPokerSetup(setupInput());
  renderSetupPlan(plan);
}

function metricCard(label, value, detail = "") {
  return `<div class="metric-card"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</div>`;
}

function renderSetupPlan(plan) {
  const opening = plan.openingBlinds;
  $("#setup-metrics").innerHTML = [
    metricCard("Starting Stack", formatNumber(plan.startingStack), plan.requestedStack ? (plan.exactStackMatch ? "Wunsch exakt" : `statt ${formatNumber(plan.requestedStack)}`) : "automatisch"),
    metricCard("Opening Blinds", `${formatNumber(opening.sb)} / ${formatNumber(opening.bb)}`, `~${Math.round(plan.startingStack / opening.bb)} BB`),
    metricCard("Spieler", String(plan.players), `${formatNumber(plan.startingStack * plan.players)} Chips im Spiel`),
    metricCard("Bank / Reserve", plan.totalReserveValue == null ? "teilw. offen" : formatNumber(plan.totalReserveValue), plan.completeInventory ? "voll berechnet" : "nur bekannte Bestände")
  ].join("");

  $("#distribution-list").innerHTML = plan.perPlayer.map((chip) => `
    <div class="distribution-row">
      <span class="chip-dot" style="background:${chip.color}"></span>
      <div><strong>${formatNumber(chip.value)}</strong><small>${chip.reserve == null ? "Bestand offen" : `${formatNumber(chip.reserve)} Reserve`}</small></div>
      <span class="distribution-count">× ${chip.perPlayer}</span>
    </div>
  `).join("");

  $("#blind-table").innerHTML = plan.blindLevels.map((level) => {
    const trigger = plan.blindMode === "time"
      ? (level.level === 1 ? "Start" : `ab ${level.startsAtMinutes} min`)
      : (level.level === 1 ? "Start" : `nach ${level.startsAfterRounds} Orbit${level.startsAfterRounds === 1 ? "" : "s"} · ~${level.estimatedStartsAtMinutes} min`);
    return `<div class="blind-row"><span class="blind-level">L${level.level}</span><span class="blind-values">${formatNumber(level.sb)} / ${formatNumber(level.bb)}</span><span class="blind-trigger">${trigger}</span></div>`;
  }).join("");

  const notes = [
    ...plan.warnings.map((text) => ({ text, warning: true })),
    ...plan.assumptions.map((text) => ({ text, warning: false })),
    { text: "Die Blind-Struktur zielt auf die gewünschte Dauer, kann sie aber nicht garantieren. Spieltempo, All-ins und Kartenverlauf verändern die echte Laufzeit.", warning: false }
  ];
  $("#setup-notes").innerHTML = `<div class="note-list">${notes.map((note) => `<div class="note ${note.warning ? "warning" : ""}">${note.text}</div>`).join("")}</div>`;
}

// ODDS + CARD PICKER ---------------------------------------------------------
const oddsState = {
  hero: [null, null],
  board: [null, null, null, null, null],
  opponentCount: 1,
  opponents: Array.from({ length: 8 }, () => [null, null]),
  pickerTarget: null,
  pickerRank: null,
  calculationToken: 0,
  lastResult: null
};

const worker = new Worker(new URL("./odds-worker.js", import.meta.url), { type: "module" });

function targetValue(target) {
  if (!target) return null;
  if (target.type === "hero") return oddsState.hero[target.index];
  if (target.type === "board") return oddsState.board[target.index];
  if (target.type === "opponent") return oddsState.opponents[target.opponentIndex][target.index];
  return null;
}

function setTargetValue(target, value) {
  if (target.type === "hero") oddsState.hero[target.index] = value;
  else if (target.type === "board") oddsState.board[target.index] = value;
  else if (target.type === "opponent") oddsState.opponents[target.opponentIndex][target.index] = value;
}

function allSelectedCards({ excludeTarget = null } = {}) {
  const values = [];
  oddsState.hero.forEach((card, index) => { if (card && !(excludeTarget?.type === "hero" && excludeTarget.index === index)) values.push(card); });
  oddsState.board.forEach((card, index) => { if (card && !(excludeTarget?.type === "board" && excludeTarget.index === index)) values.push(card); });
  oddsState.opponents.slice(0, oddsState.opponentCount).forEach((hand, opponentIndex) => hand.forEach((card, index) => {
    if (card && !(excludeTarget?.type === "opponent" && excludeTarget.opponentIndex === opponentIndex && excludeTarget.index === index)) values.push(card);
  }));
  return values;
}

function slotHtml(card, label, target) {
  const parsed = parseCard(card);
  const suit = card ? suitMeta(card) : null;
  const targetData = encodeURIComponent(JSON.stringify(target));
  if (!parsed) {
    return `<button class="card-slot" type="button" data-card-target="${targetData}" aria-label="${label} wählen"><span><span class="slot-plus">+</span><span class="slot-label">${label}</span></span></button>`;
  }
  return `<button class="card-slot filled ${suit?.color === "red" ? "red" : ""}" type="button" data-card-target="${targetData}" aria-label="${label}: ${cardLabel(card)} ändern"><span><span class="card-rank">${parsed.rank}</span><span class="card-suit">${suit?.symbol}</span></span></button>`;
}

function bindCardSlots(root = document) {
  $$("[data-card-target]", root).forEach((button) => button.addEventListener("click", () => {
    openCardPicker(JSON.parse(decodeURIComponent(button.dataset.cardTarget)));
  }));
}

function renderCards() {
  $("#hero-slots").innerHTML = oddsState.hero.map((card, index) => slotHtml(card, `Hole ${index + 1}`, { type: "hero", index })).join("");
  $("#board-slots").innerHTML = oddsState.board.map((card, index) => {
    const labels = ["Flop 1", "Flop 2", "Flop 3", "Turn", "River"];
    return slotHtml(card, labels[index], { type: "board", index });
  }).join("");
  renderOpponentRows();
  bindCardSlots($("#panel-odds"));
  renderPreflopStrength();
}

function renderOpponentRows() {
  $("#opponent-card-rows").innerHTML = Array.from({ length: oddsState.opponentCount }, (_, opponentIndex) => `
    <div class="opponent-card-row">
      <span>Gegner ${opponentIndex + 1}</span>
      ${oddsState.opponents[opponentIndex].map((card, index) => slotHtml(card, `Gegner ${opponentIndex + 1}, Karte ${index + 1}`, { type: "opponent", opponentIndex, index })).join("")}
    </div>
  `).join("");
}

function renderPreflopStrength() {
  const hero = oddsState.hero.filter(Boolean);
  const strength = preflopStartingScore(hero);
  if (!strength) {
    $("#preflop-notation").textContent = "2 Karten wählen";
    $("#preflop-strength").hidden = true;
    return;
  }
  $("#preflop-notation").textContent = strength.notation;
  $("#preflop-strength").hidden = false;
  $("#preflop-strength").innerHTML = `<strong>${strength.label} · Startkarten-Score ${strength.score}</strong><span>Fester Karten-Score aus Pair-, Suited-, High-Card- und Gap-Struktur. Die echte Equity darunter hängt zusätzlich von Gegnerzahl und unbekannten Karten ab.</span>`;
}

function openCardPicker(target) {
  oddsState.pickerTarget = target;
  oddsState.pickerRank = parseCard(targetValue(target))?.rank || null;
  renderPicker();
  $("#card-picker").showModal();
}

function renderPicker() {
  $("#picker-title").textContent = oddsState.pickerRank ? `${oddsState.pickerRank} · Suit` : "Rang";
  $("#rank-picker").innerHTML = RANKS.map((rank) => `<button type="button" class="rank-choice ${oddsState.pickerRank === rank ? "is-active" : ""}" data-rank="${rank}">${rank}</button>`).join("");
  $$(".rank-choice", $("#rank-picker")).forEach((button) => button.addEventListener("click", () => {
    oddsState.pickerRank = button.dataset.rank;
    renderPicker();
  }));

  const suitPicker = $("#suit-picker");
  suitPicker.hidden = !oddsState.pickerRank;
  if (oddsState.pickerRank) {
    const used = new Set(allSelectedCards({ excludeTarget: oddsState.pickerTarget }));
    suitPicker.innerHTML = SUITS.map((suit) => {
      const card = `${oddsState.pickerRank}${suit.key}`;
      return `<button type="button" class="suit-choice ${suit.color === "red" ? "red" : ""}" data-suit="${suit.key}" ${used.has(card) ? "disabled" : ""} aria-label="${oddsState.pickerRank} ${suit.name}">${suit.symbol}</button>`;
    }).join("");
    $$(".suit-choice", suitPicker).forEach((button) => button.addEventListener("click", () => {
      const card = `${oddsState.pickerRank}${button.dataset.suit}`;
      setTargetValue(oddsState.pickerTarget, card);
      $("#card-picker").close();
      afterCardsChanged();
    }));
  }
  $("#clear-card").disabled = !targetValue(oddsState.pickerTarget);
}

$("#picker-close").addEventListener("click", () => $("#card-picker").close());
$("#clear-card").addEventListener("click", () => {
  if (oddsState.pickerTarget) setTargetValue(oddsState.pickerTarget, null);
  $("#card-picker").close();
  afterCardsChanged();
});
$("#card-picker").addEventListener("click", (event) => {
  if (event.target === $("#card-picker")) $("#card-picker").close();
});
$("#clear-board").addEventListener("click", () => {
  oddsState.board = [null, null, null, null, null];
  afterCardsChanged();
});

function sanitizeActiveOpponentCards() {
  const used = new Set([...oddsState.hero, ...oddsState.board].filter(Boolean));
  for (let opponentIndex = 0; opponentIndex < oddsState.opponentCount; opponentIndex += 1) {
    for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
      const card = oddsState.opponents[opponentIndex][cardIndex];
      if (!card) continue;
      if (used.has(card)) oddsState.opponents[opponentIndex][cardIndex] = null;
      else used.add(card);
    }
  }
}

$("#opponent-count").addEventListener("input", (event) => {
  oddsState.opponentCount = Number(event.target.value);
  sanitizeActiveOpponentCards();
  $("#opponent-count-label").textContent = String(oddsState.opponentCount);
  renderCards();
  calculateOdds();
});

function afterCardsChanged() {
  renderCards();
  calculateOdds();
}

function validBoardCards() {
  const selected = oddsState.board.filter(Boolean);
  return [0, 3, 4, 5].includes(selected.length) ? selected : null;
}

function calculationPlaceholder(message) {
  $("#odds-placeholder").hidden = false;
  $("#odds-results").hidden = true;
  $("#odds-placeholder").innerHTML = `<span class="placeholder-card">% </span><p>${message}</p>`;
}

function calculateOdds() {
  const hero = oddsState.hero.filter(Boolean);
  const board = validBoardCards();
  oddsState.lastResult = null;
  renderDecision();

  if (hero.length !== 2) {
    calculationPlaceholder("Wähle beide Hole Cards. Danach startet die Berechnung automatisch.");
    return;
  }
  if (!board) {
    calculationPlaceholder("Flop bitte vollständig mit drei Karten wählen; danach sind Turn und River einzeln möglich.");
    return;
  }

  const token = ++oddsState.calculationToken;
  const opponents = oddsState.opponents.slice(0, oddsState.opponentCount).map((hand) => [...hand]);
  $("#odds-placeholder").hidden = true;
  $("#odds-results").hidden = false;
  $("#odds-metrics").innerHTML = [metricCard("Win", "…"), metricCard("Tie", "…"), metricCard("Loss", "…")].join("");
  $("#calculation-meta").innerHTML = `<span>Berechnung läuft lokal …</span><span class="calc-progress"><span style="width:8%"></span></span>`;
  renderHandAnalysis(hero, board);

  worker.postMessage({ type: "calculate", token, hero, board, opponents });
}

worker.addEventListener("message", (event) => {
  const result = event.data || {};
  if (result.token !== oddsState.calculationToken) return;
  oddsState.lastResult = result;
  renderOddsResult(result);
  renderDecision();
});

function renderOddsResult(result) {
  $("#odds-metrics").innerHTML = `
    <div class="metric-card win"><span>Win</span><strong>${formatPercent(result.win)}</strong></div>
    <div class="metric-card"><span>Tie</span><strong>${formatPercent(result.tie)}</strong></div>
    <div class="metric-card loss"><span>Loss</span><strong>${formatPercent(result.loss)}</strong></div>
  `;
  const mode = result.mode === "exact" ? "exakt" : "Monte Carlo";
  const target = result.mode === "exact" ? Math.max(1, result.estimatedStates) : (oddsState.opponentCount <= 2 ? 30000 : oddsState.opponentCount <= 4 ? 22000 : 14000);
  const progress = result.type === "result" ? 100 : Math.min(96, Math.round((result.iterations / target) * 100));
  $("#calculation-meta").innerHTML = `<span>${mode} · ${formatNumber(result.iterations)} Zustände${result.type === "result" ? ` · Equity ${formatPercent(result.equity)}` : ""}</span><span class="calc-progress"><span style="width:${progress}%"></span></span>`;
}

function renderHandAnalysis(hero, board) {
  const known = [...hero, ...board];
  const handName = describePartialHand(known);
  const draws = board.length >= 3 && board.length < 5 ? analyzeDraws(hero, board) : null;
  const street = board.length === 0 ? "Preflop" : board.length === 3 ? "Flop" : board.length === 4 ? "Turn" : "River";
  const items = [
    ["Street", street],
    ["Made Hand", handName]
  ];
  if (draws) {
    items.push(["Flush Draw", draws.flushDraw ? "Ja" : "Nein"]);
    items.push(["Straight Draw", draws.straightDraw ? `Ja${draws.straightOutRanks.length ? ` · ${draws.straightOutRanks.join("/")}` : ""}` : "Nein"]);
    items.push(["Raw Outs", formatNumber(draws.rawOuts.length)]);
    items.push(["Verbesserung", draws.improvementChance == null ? "—" : `~${formatPercent(draws.improvementChance)}`]);
  }
  $("#hand-analysis").innerHTML = `<div class="analysis-grid">${items.map(([label, value]) => `<div class="analysis-pill"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>${draws ? `<p class="analysis-note">„Raw Outs“ sind Karten, die deine aktuelle Fünf-Karten-Wertung verbessern. Sie sind nicht automatisch Winning Outs und können auch das Board für Gegner verbessern.</p>` : ""}`;
}

// DECISION TENDENCY ----------------------------------------------------------
["#decision-situation", "#decision-position", "#decision-pot", "#decision-call", "#decision-stack"].forEach((selector) => {
  $(selector).addEventListener("input", renderDecision);
  $(selector).addEventListener("change", renderDecision);
});

function numericValue(selector) {
  const value = Number($(selector).value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function renderDecision() {
  const hero = oddsState.hero.filter(Boolean);
  const output = $("#decision-output");
  if (hero.length !== 2) {
    output.innerHTML = `<p>Mit zwei Hole Cards erscheint hier zuerst eine Preflop-Tendenz.</p>`;
    return;
  }

  const board = validBoardCards();
  if (!board) {
    output.innerHTML = `<p>Board erst als vollständigen Flop (3 Karten) ergänzen.</p>`;
    return;
  }

  const situation = $("#decision-situation").value;
  const position = $("#decision-position").value;
  const pot = numericValue("#decision-pot");
  const call = numericValue("#decision-call");
  const stack = numericValue("#decision-stack");
  const reasons = [];
  let tendency = "Unklar";
  let qualifier = "Orientierung";

  if (board.length === 0) {
    const starting = preflopStartingScore(hero);
    const positionThreshold = { early: 9, middle: 8, late: 7, blinds: 8 }[position] || 8;
    const multiwayPenalty = oddsState.opponentCount >= 4 ? 1 : oddsState.opponentCount >= 2 ? 0.5 : 0;
    const threshold = positionThreshold + multiwayPenalty;
    reasons.push(`${starting.notation}: fester Startkarten-Score ${starting.score} (${starting.label}).`);
    if (oddsState.lastResult?.type === "result" && oddsState.lastResult.equity != null) reasons.push(`Gegen ${oddsState.opponentCount} zufällige Gegner: ${formatPercent(oddsState.lastResult.equity)} Pot-Share/Equity.`);
    reasons.push(`Positions-Schwelle für diese Heuristik: ungefähr ${threshold.toFixed(1).replace(".", ",")}.`);

    if (situation === "check") {
      tendency = starting.score >= threshold + 2 ? "Raise-Kandidat" : "Check";
    } else if (situation === "unopened") {
      tendency = starting.score >= threshold ? "Raise-Kandidat" : "Fold-Tendenz";
    } else if (starting.score >= 12) {
      tendency = "Raise-Kandidat";
    } else if (starting.score >= threshold + 1) {
      tendency = "Call-Tendenz";
    } else {
      tendency = "Fold-Tendenz";
    }
    qualifier = "Preflop-Heuristik";
    reasons.push("Eine echte gegnerische Raising-/Calling-Range wird nicht modelliert; deshalb ist die Zufallsgegner-Equity kein Solver-Signal.");
  } else {
    const result = oddsState.lastResult;
    if (!result || result.type !== "result") {
      output.innerHTML = `<p>Equity wird noch berechnet. Die Tendenz aktualisiert sich automatisch.</p>`;
      return;
    }

    const equity = result.equity;
    const made = describePartialHand([...hero, ...board]);
    reasons.push(`${made}; berechneter Pot-Share ${formatPercent(equity)} gegen die aktuell angenommenen Gegnerkarten.`);

    if (situation === "facing") {
      if (pot && call) {
        const required = call / (pot + call);
        const margin = equity - required;
        reasons.push(`Pot Odds benötigen etwa ${formatPercent(required)} Equity; Abstand aktuell ${margin >= 0 ? "+" : ""}${formatPercent(Math.abs(margin))}.`);
        if (margin < -0.03) tendency = "Fold-Tendenz";
        else if (margin < 0.10) tendency = "Call-Tendenz";
        else tendency = equity >= 0.68 ? "Raise-Kandidat" : "Call-Tendenz";
      } else {
        tendency = equity >= 0.67 ? "Raise-Kandidat" : equity >= 0.43 ? "Call-Tendenz" : "Fold-Tendenz";
        reasons.push("Ohne Pot + Call-Betrag kann keine echte Break-even-Schwelle berechnet werden.");
      }
    } else {
      tendency = equity >= 0.63 ? "Bet / Raise-Kandidat" : "Check";
    }

    if (pot && stack) {
      const spr = stack / pot;
      reasons.push(`Effective Stack / Pot ergibt SPR ≈ ${spr.toFixed(1).replace(".", ",")}; niedriger SPR erhöht typischerweise die Bindung an starke Made Hands.`);
    }
    reasons.push("Gegnerische Ranges, Reads, Fold Equity und vorherige Action sind nicht vollständig modelliert.");
    qualifier = "Postflop-Tendenz";
  }

  output.innerHTML = `
    <div class="decision-callout"><strong>${tendency}</strong><span>${qualifier}</span></div>
    <ul class="decision-reasons">${reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
  `;
}

renderRankings();
renderChipEditor();
calculateSetup();
renderCards();
calculateOdds();
