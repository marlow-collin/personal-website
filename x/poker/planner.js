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

function deriveTargetStack(inputStack) {
  return inputStack || DEFAULT_STACK;
}

function buildBlindSchedule({ stack, players, duration, mode, levelMinutes, roundsPerLevel, smallest, minutesPerHand }) {
  const opening = Math.abs(stack - DEFAULT_STACK) <= 5 && smallest <= 5 ? { sb: 5, bb: 10 } : chooseOpeningBlinds(stack, [{ value: smallest }]);
  const estimatedMinutesPerHand = minutesPerHand || DEFAULT_MINUTES_PER_HAND;
  const estimatedLevelMinutes = mode === "rounds"
    ? players * roundsPerLevel * estimatedMinutesPerHand
    : levelMinutes;
  const levelCount = duration
    ? clamp(Math.ceil(duration / Math.max(5, estimatedLevelMinutes)), 5, 18)
    : 9;

  // Für rundenbasierte Homegames entsteht Beschleunigung bereits dadurch, dass
  // volle Tischrunden mit weniger Spielern weniger Hände benötigen. Keine künstliche
  // Ausscheidungskurve in die Blindfolge einrechnen.
  const targetEndBB = Math.max(opening.bb * 12, stack / 8);
  const factor = levelCount > 1
    ? clamp((targetEndBB / opening.bb) ** (1 / (levelCount - 1)), 1.28, 1.65)
    : 1.5;

  const levels = [];
  let previousBB = 0;
  for (let i = 0; i < levelCount; i += 1) {
    let bb = roundToChipFriendly(opening.bb * (factor ** i), smallest);
    if (bb <= previousBB) bb = roundToChipFriendly(previousBB + smallest, smallest);
    let sb = roundToChipFriendly(bb / 2, smallest);
    if (sb >= bb) sb = Math.max(smallest, bb - smallest);
    previousBB = bb;
    levels.push({
      level: i + 1,
      sb,
      bb,
      startsAtMinutes: mode === "time" ? i * levelMinutes : null,
      startsAfterRounds: mode === "rounds" ? i * roundsPerLevel : null,
      estimatedStartsAtMinutes: mode === "rounds" ? Math.round(i * estimatedLevelMinutes) : null
    });
  }

  return { levels, estimatedLevelMinutes, factor };
}

export function planPokerSetup(input = {}) {
  const players = clamp(asPositiveInt(input.players) || DEFAULT_PLAYERS, 2, 10);
  const duration = asPositiveInt(input.durationMinutes) || null;
  const mode = input.blindMode === "time" ? "time" : "rounds";
  const levelMinutes = clamp(asPositiveInt(input.levelMinutes) || DEFAULT_LEVEL_MINUTES, 5, 90);
  const roundsPerLevel = clamp(asPositiveInt(input.roundsPerLevel) || DEFAULT_ROUNDS_PER_LEVEL, 1, 10);
  const minutesPerHand = input.pace === "regular" ? 2.5 : DEFAULT_MINUTES_PER_HAND;

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

  const requestedStack = asPositiveInt(input.startingStack);
  const targetStack = deriveTargetStack(requestedStack);
  let distribution = findDistribution(chips, players, targetStack);
  const referenceCounts = new Map([[1, 0], [5, 16], [10, 16], [25, 8], [100, 8], [500, 3], [1000, 0]]);
  const canUseReference = targetStack === DEFAULT_STACK && chips.every((chip) => !referenceCounts.has(chip.value) || chip.count == null || referenceCounts.get(chip.value) * players <= chip.count) && [5,10,25,100,500].every((value) => chips.some((chip) => chip.value === value));
  if (canUseReference) {
    const counts = chips.map((chip) => referenceCounts.get(chip.value) || 0);
    distribution = { counts, value: DEFAULT_STACK, distance: 0, score: 0 };
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
    stack: actualStack,
    players,
    duration: duration || DEFAULT_DURATION,
    mode,
    levelMinutes,
    roundsPerLevel,
    smallest,
    minutesPerHand
  });

  const assumptions = [];
  if (!input.players) assumptions.push(`${DEFAULT_PLAYERS} Spieler als Standard angenommen.`);
  if (!duration) assumptions.push(`${DEFAULT_DURATION} Minuten als Planungsziel angenommen.`);
  if (!requestedStack) assumptions.push(`${DEFAULT_STACK.toLocaleString("de-DE")} Chips als bewährter Homegame-Starting-Stack angenommen.`);
  if (!Array.isArray(input.chips) || !input.chips.some((chip) => asPositiveInt(chip.value))) assumptions.push(`Standard-Denominations ${DEFAULT_DENOMS.join(" / ")} angenommen.`);
  if (!completeInventory) assumptions.push(`Leere Chip-Anzahlen gelten als unbekannt/unbegrenzt; Reserve ist dafür nicht berechenbar.`);
  if (mode === "rounds") assumptions.push(`Standard: Blindwechsel nach ${roundsPerLevel} vollen Tischrunden. Bei ${players} Spielern sind das ${players * roundsPerLevel} Hände pro Level; mit weniger Spielern wird ein Level automatisch kürzer.`);
  assumptions.push(`Zeitprognose: ca. ${String(minutesPerHand).replace(".", ",")} Minuten pro Hand (${minutesPerHand > 3 ? "Entspannt" : "Regulär"}).`);
  assumptions.push(`Nicht verteilte Chips bleiben bewusst als Bank/Reserve verfügbar.`);

  const warnings = [];
  if (requestedStack && distribution && distribution.value !== requestedStack) {
    warnings.push(`Der gewünschte Stack ${requestedStack.toLocaleString("de-DE")} ist mit den angegebenen Constraints nicht exakt erreichbar; nächster sinnvoller Vorschlag: ${distribution.value.toLocaleString("de-DE")}.`);
  }
  for (const chip of perPlayer) {
    if (chip.count != null && chip.perPlayer === 0 && chip.count > 0) warnings.push(`Denomination ${chip.value.toLocaleString("de-DE")} kann bei ${players} Spielern nicht sinnvoll gleich verteilt werden.`);
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
    startingStack: actualStack,
    exactStackMatch: !requestedStack || actualStack === requestedStack,
    perPlayer,
    knownInventory,
    completeInventory,
    totalReserveValue: knownInventory ? totalReserveValue : null,
    openingBlinds: blindSchedule.levels[0],
    blindLevels: blindSchedule.levels,
    estimatedLevelMinutes: blindSchedule.estimatedLevelMinutes,
    assumptions,
    warnings
  };
}
