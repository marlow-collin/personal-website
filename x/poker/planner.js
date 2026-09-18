const DEFAULT_DENOMS = Object.freeze([1, 5, 10, 25, 100, 500, 1000]);
const DEFAULT_PLAYERS = 6;
const DEFAULT_DURATION = 300;
const DEFAULT_STACK = 2740;
const DEFAULT_LEVEL_MINUTES = 20;
const DEFAULT_ROUNDS_PER_LEVEL = 2;
const DEFAULT_MINUTES_PER_HAND = 3.5;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function asPositiveInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

function gcdAll(values) {
  return values.reduce((current, value) => gcd(current, value), values[0] || 1);
}

function niceBlindUnits(raw) {
  if (raw <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const closest = steps.reduce((best, step) => Math.abs(step - normalized) < Math.abs(best - normalized) ? step : best, steps[0]);
  return closest * power;
}

function roundToChipFriendly(raw, smallest) {
  const unit = Math.max(1, smallest);
  const normalized = raw / unit;
  return Math.max(unit, Math.round(niceBlindUnits(normalized) * unit));
}

function chooseOpeningBlinds(targetStack, denoms) {
  const smallest = Number(denoms[0]?.value ?? denoms[0]) || 1;
  const desiredBB = Math.max(smallest * 2, targetStack / 100);
  let bb = roundToChipFriendly(desiredBB, smallest);
  if (bb < smallest * 2) bb = smallest * 2;
  let sb = roundToChipFriendly(bb / 2, smallest);
  if (sb >= bb) sb = Math.max(smallest, bb - smallest);
  return { sb, bb };
}

function candidateCap(chip, players, target) {
  if (chip.count != null) return Math.max(0, Math.floor(chip.count / players));
  return Math.min(30, Math.max(0, Math.floor(target / chip.value) + 2));
}

function distributionPenalty(counts, chips) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  let penalty = Math.abs(total - 28) * 0.35;
  counts.forEach((count, index) => {
    const ideal = index === 0 ? 8 : index === 1 ? 8 : index === 2 ? 6 : index === 3 ? 4 : 2;
    penalty += Math.abs(count - ideal) * (index < 2 ? 0.55 : 0.25);
  });
  if (counts[0] < 4) penalty += 6;
  if (chips.length > 1 && counts[1] < 3) penalty += 3;
  return penalty;
}

function findDistribution(chips, players, target) {
  if (!chips.length || !target) return null;
  const unit = gcdAll(chips.map((chip) => chip.value));
  const scaledTarget = Math.max(1, Math.round(target / unit));
  const limit = Math.min(120000, scaledTarget + Math.ceil(Math.max(...chips.map((chip) => chip.value)) * 2 / unit));
  let states = new Map([[0, { counts: Array(chips.length).fill(0), penalty: 0 }]]);

  chips.forEach((chip, chipIndex) => {
    const next = new Map();
    const scaledValue = Math.max(1, Math.round(chip.value / unit));
    const cap = candidateCap(chip, players, target);
    for (const [sum, state] of states) {
      for (let count = 0; count <= cap; count += 1) {
        const newSum = sum + count * scaledValue;
        if (newSum > limit) break;
        const counts = [...state.counts];
        counts[chipIndex] = count;
        const penalty = distributionPenalty(counts, chips);
        const existing = next.get(newSum);
        if (!existing || penalty < existing.penalty) next.set(newSum, { counts, penalty });
      }
    }
    states = next;
  });

  let best = null;
  for (const [sum, state] of states) {
    const value = sum * unit;
    const distance = Math.abs(value - target);
    const score = (distance / Math.max(1, unit)) * 100 + state.penalty;
    if (!best || score < best.score || (score === best.score && value <= target && best.value > target)) {
      best = { ...state, value, distance, score };
    }
  }
  return best;
}

function autoStartingStack({ players, duration, openingBb, chips }) {
  const desiredBB = clamp(Math.round(130 + ((duration || DEFAULT_DURATION) - 180) / 4), 100, 220);
  const desired = Math.max(openingBb * 80, openingBb * desiredBB);
  const inventoryValue = chips.reduce((sum, chip) => sum + (chip.count == null ? 0 : chip.value * chip.count), 0);
  const hasCompleteInventory = chips.length && chips.every((chip) => chip.count != null);
  const reserveFactor = 0.72; // bewusst genügend große Chips für spätere Color-ups zurückhalten
  const inventoryCap = hasCompleteInventory ? Math.floor((inventoryValue * reserveFactor) / players) : desired;
  const cap = Math.max(openingBb * 60, Math.min(desired, inventoryCap));
  const unit = openingBb >= 10 ? 100 : 50;
  return Math.max(openingBb * 60, Math.round(cap / unit) * unit);
}

function autoRoundsPerLevel(duration, players, minutesPerHand) {
  const oneRoundMinutes = Math.max(1, players * minutesPerHand);
  // Etwa 8–10 Blindstufen sind für einen privaten Freezeout gut handhabbar.
  return clamp(Math.round((duration || DEFAULT_DURATION) / (9 * oneRoundMinutes)), 1, 4);
}

const BLIND_LADDER = Object.freeze([
  [1, 2], [2, 5], [5, 10], [10, 25], [25, 50], [50, 100],
  [100, 200], [200, 400], [400, 800], [800, 1600], [1500, 3000],
  [3000, 6000], [5000, 10000], [10000, 20000]
]);

function chooseBlindStart(duration, allowSmallBlinds) {
  if (!allowSmallBlinds) return 2; // 5/10
  if ((duration || DEFAULT_DURATION) >= 480) return 0; // 1/2 bei bewusst langen Abenden
  return 1; // 2/5 als praktischer kleiner Start
}

function buildBlindSchedule({ players, duration, mode, levelMinutes, roundsPerLevel, minutesPerHand, allowSmallBlinds }) {
  const estimatedMinutesPerHand = minutesPerHand || DEFAULT_MINUTES_PER_HAND;
  const estimatedLevelMinutes = mode === "rounds" ? players * roundsPerLevel * estimatedMinutesPerHand : levelMinutes;
  const levelCount = duration ? clamp(Math.ceil(duration / Math.max(5, estimatedLevelMinutes)), 5, 12) : 9;
  const startIndex = chooseBlindStart(duration || DEFAULT_DURATION, allowSmallBlinds);
  const levels = Array.from({ length: levelCount }, (_, i) => {
    const pair = BLIND_LADDER[Math.min(startIndex + i, BLIND_LADDER.length - 1)];
    return {
      level: i + 1, sb: pair[0], bb: pair[1],
      startsAtMinutes: mode === "time" ? i * levelMinutes : null,
      startsAfterRounds: mode === "rounds" ? i * roundsPerLevel : null,
      estimatedStartsAtMinutes: mode === "rounds" ? Math.round(i * estimatedLevelMinutes) : null
    };
  });
  return { levels, estimatedLevelMinutes };
}

export function planPokerSetup(input = {}) {
  const players = clamp(asPositiveInt(input.players) || DEFAULT_PLAYERS, 2, 10);
  const duration = asPositiveInt(input.durationMinutes) || null;
  const mode = input.blindMode === "time" ? "time" : "rounds";
  const levelMinutes = clamp(asPositiveInt(input.levelMinutes) || DEFAULT_LEVEL_MINUTES, 5, 90);
  const minutesPerHand = input.pace === "regular" ? 2.5 : DEFAULT_MINUTES_PER_HAND;
  const requestedRounds = asPositiveInt(input.roundsPerLevel);
  const roundsPerLevel = clamp(requestedRounds || autoRoundsPerLevel(duration || DEFAULT_DURATION, players, minutesPerHand), 1, 10);

  let chips = Array.isArray(input.chips) ? input.chips
    .map((chip, index) => ({
      id: chip.id || `chip-${index}`,
      color: chip.color || "#777777",
      value: asPositiveInt(chip.value),
      count: (() => {
        if (chip.count === "" || chip.count == null) return null;
        const parsed = Number(chip.count);
        return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
      })()
    }))
    .filter((chip) => chip.value) : [];

  if (!chips.length) {
    chips = DEFAULT_DENOMS.map((value, index) => ({ id: `auto-${index}`, color: "#777777", value, count: null }));
  }
  chips.sort((a, b) => a.value - b.value);

  const allowSmallBlinds = input.allowSmallBlinds === true;
  const startIndex = chooseBlindStart(duration || DEFAULT_DURATION, allowSmallBlinds);
  const openingPair = BLIND_LADDER[startIndex];
  const requestedStack = asPositiveInt(input.startingStack);
  const eligibleChips = allowSmallBlinds ? chips : chips.filter((chip) => chip.value >= 5);
  const autoStack = autoStartingStack({ players, duration: duration || DEFAULT_DURATION, openingBb: openingPair[1], chips: eligibleChips });
  const targetStack = requestedStack || autoStack;
  const eligibleDistribution = findDistribution(eligibleChips, players, targetStack);
  let distribution = null;
  if (eligibleDistribution) {
    const byId = new Map(eligibleChips.map((chip, index) => [chip.id, eligibleDistribution.counts[index] || 0]));
    distribution = { ...eligibleDistribution, counts: chips.map((chip) => byId.get(chip.id) || 0) };
  }
  const actualStack = distribution?.value || targetStack;
  const knownInventory = chips.some((chip) => chip.count != null);
  const completeInventory = chips.every((chip) => chip.count != null);

  const perPlayer = chips.map((chip, index) => ({
    ...chip,
    perPlayer: distribution?.counts[index] || 0,
    used: (distribution?.counts[index] || 0) * players,
    reserve: chip.count == null ? null : Math.max(0, chip.count - (distribution?.counts[index] || 0) * players)
  }));

  const totalReserveValue = perPlayer.reduce((sum, chip) => sum + (chip.reserve == null ? 0 : chip.reserve * chip.value), 0);
  const smallest = chips[0]?.value || 25;
  const blindSchedule = buildBlindSchedule({
    players,
    duration: duration || DEFAULT_DURATION,
    mode,
    levelMinutes,
    roundsPerLevel,
    minutesPerHand,
    allowSmallBlinds
  });

  const assumptions = [];
  if (!input.players) assumptions.push(`${DEFAULT_PLAYERS} Spieler als Standard angenommen.`);
  if (!duration) assumptions.push(`${DEFAULT_DURATION} Minuten als Planungsziel angenommen.`);
  if (!requestedStack) assumptions.push(`${actualStack.toLocaleString("de-DE")} Chips Starting Stack automatisch aus Spielerzahl, Dauer, Startblinds und verfügbarem Inventar geplant.`);
  if (!Array.isArray(input.chips) || !input.chips.some((chip) => asPositiveInt(chip.value))) assumptions.push(`Standard-Denominations ${DEFAULT_DENOMS.join(" / ")} angenommen.`);
  if (!completeInventory) assumptions.push(`Leere Chip-Anzahlen gelten als unbekannt/unbegrenzt; Reserve ist dafür nicht berechenbar.`);
  if (mode === "rounds") assumptions.push(`${requestedRounds ? "Vorgabe" : "Automatisch geplant"}: Blindwechsel nach ${roundsPerLevel} vollen Tischrunden. Bei ${players} Spielern sind das ${players * roundsPerLevel} Hände pro Level; mit weniger Spielern wird ein Level automatisch kürzer.`);
  assumptions.push(`Zeitprognose: ca. ${String(minutesPerHand).replace(".", ",")} Minuten pro Hand (${minutesPerHand > 3 ? "Entspannt" : "Regulär"}).`);
  assumptions.push(allowSmallBlinds ? `Kleine Blindstufen sind aktiv: 1er-Chips dürfen im Startstack genutzt und später ausgewechselt werden.` : `Kleine Blindstufen sind aus: Start frühestens bei 5/10; 1er-Chips bleiben in der Bank.`);
  assumptions.push(`Nicht verteilte Chips bleiben bewusst als Bank/Reserve für spätere Color-ups verfügbar.`);

  const warnings = [];
  if (requestedStack && distribution && distribution.value !== requestedStack) {
    warnings.push(`Der gewünschte Stack ${requestedStack.toLocaleString("de-DE")} ist mit den angegebenen Constraints nicht exakt erreichbar; nächster sinnvoller Vorschlag: ${distribution.value.toLocaleString("de-DE")}.`);
  }
  for (const chip of perPlayer) {
    if (chip.count != null && chip.perPlayer === 0 && chip.count > 0) warnings.push(`Denomination ${chip.value.toLocaleString("de-DE")} kann bei ${players} Spielern nicht sinnvoll gleich verteilt werden.`);
  }

  const colorUps = [];
  const usedValues = perPlayer.filter((chip) => chip.perPlayer > 0).map((chip) => chip.value).sort((a, b) => a - b);
  const canMakeWith = (amount, values) => {
    const possible = Array(amount + 1).fill(false); possible[0] = true;
    for (let sum = 1; sum <= amount; sum += 1) possible[sum] = values.some((value) => sum >= value && possible[sum - value]);
    return possible[amount];
  };
  for (const value of usedValues) {
    const higherValues = chips.filter((chip) => chip.value > value).map((chip) => chip.value);
    if (!higherValues.length) continue;
    for (let i = 0; i < blindSchedule.levels.length - 1; i += 1) {
      const future = blindSchedule.levels.slice(i + 1);
      if (future.length && future.every((level) => canMakeWith(level.sb, higherValues) && canMakeWith(level.bb, higherValues))) {
        colorUps.push({ value, afterSb: blindSchedule.levels[i].sb, afterBb: blindSchedule.levels[i].bb });
        break;
      }
    }
  }

  return {
    players,
    requestedDuration: duration,
    planningDuration: duration || DEFAULT_DURATION,
    blindMode: mode,
    levelMinutes,
    roundsPerLevel,
    minutesPerHand,
    targetStack,
    requestedStack,
    allowSmallBlinds,
    startingStack: actualStack,
    exactStackMatch: !requestedStack || actualStack === requestedStack,
    perPlayer,
    knownInventory,
    completeInventory,
    totalReserveValue: knownInventory ? totalReserveValue : null,
    openingBlinds: blindSchedule.levels[0],
    blindLevels: blindSchedule.levels,
    estimatedLevelMinutes: blindSchedule.estimatedLevelMinutes,
    colorUps,
    assumptions,
    warnings
  };
}
