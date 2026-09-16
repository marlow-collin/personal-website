export const RANKS = Object.freeze(["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]);
export const SUITS = Object.freeze([
  { key: "s", symbol: "♠", name: "Pik", color: "black" },
  { key: "h", symbol: "♥", name: "Herz", color: "red" },
  { key: "d", symbol: "♦", name: "Karo", color: "red" },
  { key: "c", symbol: "♣", name: "Kreuz", color: "black" }
]);

const RANK_VALUE = Object.freeze({ "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 });
const VALUE_RANK = Object.freeze({ 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" });
const CATEGORY_NAMES = Object.freeze(["High Card", "One Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"]);

export const FULL_DECK = Object.freeze(SUITS.flatMap(({ key: suit }) => RANKS.map((rank) => `${rank}${suit}`)));

export function parseCard(card) {
  if (!card || typeof card !== "string") return null;
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const value = RANK_VALUE[rank];
  if (!value || !SUITS.some((entry) => entry.key === suit)) return null;
  return { card, rank, value, suit };
}

export function cardLabel(card) {
  const parsed = parseCard(card);
  if (!parsed) return "";
  const suit = SUITS.find((entry) => entry.key === parsed.suit);
  return `${parsed.rank}${suit?.symbol || ""}`;
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const window = unique.slice(i, i + 5);
    if (window.every((value, index) => index === 0 || value === window[index - 1] - 1)) {
      return window[0] === 1 ? 5 : window[0];
    }
  }
  return 0;
}

export function evaluateFive(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) throw new Error("evaluateFive expects exactly five cards");
  const parsed = cards.map(parseCard);
  if (parsed.some((card) => !card)) throw new Error("Invalid card");

  const values = parsed.map((card) => card.value).sort((a, b) => b - a);
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = parsed.every((card) => card.suit === parsed[0].suit);
  const sHigh = straightHigh(values);

  let rank;
  if (flush && sHigh) {
    rank = [8, sHigh];
  } else if (groups[0][1] === 4) {
    rank = [7, groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    rank = [6, groups[0][0], groups[1][0]];
  } else if (flush) {
    rank = [5, ...values];
  } else if (sHigh) {
    rank = [4, sHigh];
  } else if (groups[0][1] === 3) {
    const kickers = groups.filter((group) => group[1] === 1).map((group) => group[0]).sort((a, b) => b - a);
    rank = [3, groups[0][0], ...kickers];
  } else {
    const pairs = groups.filter((group) => group[1] === 2).map((group) => group[0]).sort((a, b) => b - a);
    if (pairs.length >= 2) {
      const kicker = groups.filter((group) => group[1] === 1).map((group) => group[0]).sort((a, b) => b - a)[0];
      rank = [2, pairs[0], pairs[1], kicker];
    } else if (pairs.length === 1) {
      const kickers = groups.filter((group) => group[1] === 1).map((group) => group[0]).sort((a, b) => b - a);
      rank = [1, pairs[0], ...kickers];
    } else {
      rank = [0, ...values];
    }
  }

  return {
    rank,
    category: rank[0],
    categoryName: rank[0] === 8 && rank[1] === 14 ? "Royal Flush" : CATEGORY_NAMES[rank[0]],
    cards: [...cards]
  };
}

export function compareRankVectors(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

function combinations(items, choose, start = 0, current = [], out = []) {
  if (current.length === choose) {
    out.push([...current]);
    return out;
  }
  for (let i = start; i <= items.length - (choose - current.length); i += 1) {
    current.push(items[i]);
    combinations(items, choose, i + 1, current, out);
    current.pop();
  }
  return out;
}

export function evaluateBest(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) throw new Error("evaluateBest expects five to seven cards");
  let best = null;
  for (const combo of combinations(cards, 5)) {
    const evaluated = evaluateFive(combo);
    if (!best || compareRankVectors(evaluated.rank, best.rank) > 0) best = evaluated;
  }
  return best;
}

export function describePartialHand(cards) {
  const parsed = cards.map(parseCard).filter(Boolean);
  if (parsed.length >= 5) return evaluateBest(cards).categoryName;
  if (!parsed.length) return "Noch keine Karten";

  const counts = new Map();
  for (const card of parsed) counts.set(card.value, (counts.get(card.value) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (groups[0]?.[1] === 4) return "Four of a Kind";
  if (groups[0]?.[1] === 3) return "Three of a Kind";
  const pairs = groups.filter((entry) => entry[1] === 2);
  if (pairs.length >= 2) return "Two Pair";
  if (pairs.length === 1) return parsed.length === 2 ? "Pocket Pair" : "One Pair";
  const highest = Math.max(...parsed.map((card) => card.value));
  return `${VALUE_RANK[highest]} high`;
}

export function canonicalStartingHand(holeCards) {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) return "";
  const a = parseCard(holeCards[0]);
  const b = parseCard(holeCards[1]);
  if (!a || !b) return "";
  const ordered = a.value >= b.value ? [a, b] : [b, a];
  if (ordered[0].value === ordered[1].value) return `${ordered[0].rank}${ordered[1].rank}`;
  return `${ordered[0].rank}${ordered[1].rank}${ordered[0].suit === ordered[1].suit ? "s" : "o"}`;
}

export function preflopStartingScore(holeCards) {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) return null;
  const a = parseCard(holeCards[0]);
  const b = parseCard(holeCards[1]);
  if (!a || !b) return null;
  const high = Math.max(a.value, b.value);
  const low = Math.min(a.value, b.value);
  const baseByRank = { 14: 10, 13: 8, 12: 7, 11: 6, 10: 5, 9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1 };
  let score = baseByRank[high];
  const pair = high === low;
  if (pair) score = Math.max(5, score * 2);
  if (!pair && a.suit === b.suit) score += 2;

  if (!pair) {
    const gap = high - low - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (gap <= 1 && high < 12) score += 1;
  }

  score = Math.max(0, Math.ceil(score));
  let label = "Weak";
  if (score >= 12) label = "Premium";
  else if (score >= 10) label = "Strong";
  else if (score >= 8) label = "Playable";
  else if (score >= 6) label = "Marginal";

  return {
    score,
    label,
    notation: canonicalStartingHand(holeCards),
    pair,
    suited: !pair && a.suit === b.suit,
    gap: pair ? 0 : high - low - 1
  };
}

export function analyzeDraws(holeCards, boardCards) {
  const known = [...holeCards, ...boardCards].filter(Boolean);
  if (known.length < 5 || boardCards.length >= 5) {
    return { flushDraw: false, straightDraw: false, straightOutRanks: [], rawOuts: [], improvementChance: null };
  }

  const parsed = known.map(parseCard);
  const suitCounts = new Map();
  for (const card of parsed) suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1);
  const flushDraw = [...suitCounts.values()].some((count) => count === 4);

  const rankValues = new Set(parsed.map((card) => card.value));
  if (rankValues.has(14)) rankValues.add(1);
  const missingRanks = new Set();
  for (let high = 14; high >= 5; high -= 1) {
    const sequence = high === 5 ? [5, 4, 3, 2, 1] : [high, high - 1, high - 2, high - 3, high - 4];
    const missing = sequence.filter((value) => !rankValues.has(value));
    if (missing.length === 1) missingRanks.add(missing[0] === 1 ? 14 : missing[0]);
  }

  const unseen = FULL_DECK.filter((card) => !known.includes(card));
  const baseline = evaluateBest(known);
  const rawOuts = [];
  for (const card of unseen) {
    const improved = evaluateBest([...known, card]);
    if (compareRankVectors(improved.rank, baseline.rank) > 0) rawOuts.push(card);
  }

  const outs = rawOuts.length;
  const unseenCount = unseen.length;
  const cardsToCome = Math.max(0, 5 - boardCards.length);
  let improvementChance = null;
  if (outs && cardsToCome === 1) {
    improvementChance = outs / unseenCount;
  } else if (outs && cardsToCome >= 2) {
    const missOne = (unseenCount - outs) / unseenCount;
    const missTwo = (unseenCount - outs - 1) / (unseenCount - 1);
    improvementChance = 1 - Math.max(0, missOne * missTwo);
  }

  return {
    flushDraw,
    straightDraw: missingRanks.size > 0,
    straightOutRanks: [...missingRanks].sort((a, b) => b - a).map((value) => VALUE_RANK[value]),
    rawOuts,
    improvementChance
  };
}
