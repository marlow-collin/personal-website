import { FULL_DECK, compareRankVectors, evaluateBest } from "./poker-engine.js";

let activeJob = 0;

function chooseBigInt(n, k) {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  const kk = Math.min(k, n - k);
  let result = 1n;
  for (let i = 1; i <= kk; i += 1) result = result * BigInt(n - kk + i) / BigInt(i);
  return result;
}

function estimateStates(remainingCount, boardMissing, opponents) {
  let states = 1n;
  let remaining = remainingCount;
  states *= chooseBigInt(remaining, boardMissing);
  remaining -= boardMissing;
  for (const opponent of opponents) {
    const missing = 2 - opponent.filter(Boolean).length;
    states *= chooseBigInt(remaining, missing);
    remaining -= missing;
  }
  return states;
}

function compareShowdown(hero, opponents) {
  const heroRank = evaluateBest(hero).rank;
  let bestRelation = 1;
  let tiedOpponents = 0;
  for (const opponent of opponents) {
    const relation = compareRankVectors(heroRank, evaluateBest(opponent).rank);
    if (relation < 0) return { outcome: "loss", share: 0 };
    if (relation === 0) {
      bestRelation = 0;
      tiedOpponents += 1;
    }
  }
  if (bestRelation === 0) return { outcome: "tie", share: 1 / (tiedOpponents + 1) };
  return { outcome: "win", share: 1 };
}

function makeRng() {
  const seed = new Uint32Array(4);
  crypto.getRandomValues(seed);
  let a = seed[0] || 0x9e3779b9;
  let b = seed[1] || 0x243f6a88;
  let c = seed[2] || 0xb7e15162;
  let d = seed[3] || 0xdeadbeef;
  return () => {
    const t = (a ^ (a << 11)) >>> 0;
    a = b; b = c; c = d;
    d = (d ^ (d >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    return d / 4294967296;
  };
}

function sampleWithoutReplacement(deck, count, rng) {
  const copy = [...deck];
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function combinations(items, chooseCount, callback, start = 0, current = []) {
  if (chooseCount === 0) {
    callback([...current]);
    return;
  }
  for (let i = start; i <= items.length - chooseCount; i += 1) {
    current.push(items[i]);
    combinations(items, chooseCount - 1, callback, i + 1, current);
    current.pop();
  }
}

function enumerateAssignments(deck, board, boardMissing, opponentKnown, callback, jobId) {
  combinations(deck, boardMissing, (boardDraw) => {
    if (activeJob !== jobId) return;
    const usedBoard = new Set(boardDraw);
    const afterBoard = deck.filter((card) => !usedBoard.has(card));
    const filledBoard = [...board, ...boardDraw];

    function assignOpponent(index, remaining, built) {
      if (activeJob !== jobId) return;
      if (index === opponentKnown.length) {
        callback(filledBoard, built);
        return;
      }
      const known = opponentKnown[index].filter(Boolean);
      const missing = 2 - known.length;
      combinations(remaining, missing, (drawn) => {
        const used = new Set(drawn);
        assignOpponent(index + 1, remaining.filter((card) => !used.has(card)), [...built, [...known, ...drawn]]);
      });
    }

    assignOpponent(0, afterBoard, []);
  });
}

function statsPayload(stats, mode, iterations, estimatedStates, done = true, token = null) {
  const total = Math.max(1, stats.total);
  return {
    type: done ? "result" : "progress",
    token,
    mode,
    iterations,
    estimatedStates: estimatedStates.toString(),
    win: stats.win / total,
    tie: stats.tie / total,
    loss: stats.loss / total,
    equity: stats.share / total
  };
}

function register(stats, result) {
  stats.total += 1;
  stats[result.outcome] += 1;
  stats.share += result.share;
}

self.onmessage = (event) => {
  const payload = event.data || {};
  if (payload.type !== "calculate") return;
  const jobId = ++activeJob;
  const token = payload.token ?? null;
  const hero = payload.hero || [];
  const board = payload.board || [];
  const opponents = payload.opponents || [];
  const known = new Set([...hero, ...board, ...opponents.flat().filter(Boolean)]);
  const deck = FULL_DECK.filter((card) => !known.has(card));
  const boardMissing = 5 - board.length;
  const estimatedStates = estimateStates(deck.length, boardMissing, opponents);
  const exactThreshold = 140000n;
  const stats = { total: 0, win: 0, tie: 0, loss: 0, share: 0 };

  if (estimatedStates <= exactThreshold) {
    enumerateAssignments(deck, board, boardMissing, opponents, (filledBoard, filledOpponents) => {
      register(stats, compareShowdown([...hero, ...filledBoard], filledOpponents.map((hand) => [...hand, ...filledBoard])));
    }, jobId);
    if (activeJob === jobId) self.postMessage(statsPayload(stats, "exact", stats.total, estimatedStates, true, token));
    return;
  }

  const rng = makeRng();
  const opponentMissing = opponents.map((hand) => 2 - hand.filter(Boolean).length);
  const drawCount = boardMissing + opponentMissing.reduce((sum, count) => sum + count, 0);
  const opponentCount = opponents.length;
  const targetIterations = opponentCount <= 2 ? 50000 : opponentCount <= 4 ? 35000 : 25000;
  const chunk = 1000;

  let iteration = 0;
  const runChunk = () => {
    if (activeJob !== jobId) return;
    const stop = Math.min(targetIterations, iteration + chunk);
    for (; iteration < stop; iteration += 1) {
      const sampled = sampleWithoutReplacement(deck, drawCount, rng);
      let cursor = 0;
      const filledBoard = [...board, ...sampled.slice(cursor, cursor + boardMissing)];
      cursor += boardMissing;
      const filledOpponents = opponents.map((hand, index) => {
        const knownCards = hand.filter(Boolean);
        const missing = opponentMissing[index];
        const drawn = sampled.slice(cursor, cursor + missing);
        cursor += missing;
        return [...knownCards, ...drawn];
      });
      register(stats, compareShowdown([...hero, ...filledBoard], filledOpponents.map((hand) => [...hand, ...filledBoard])));
    }
    if (iteration < targetIterations) {
      self.postMessage(statsPayload(stats, "monte-carlo", iteration, estimatedStates, false, token));
      setTimeout(runChunk, 0);
    } else if (activeJob === jobId) {
      self.postMessage(statsPayload(stats, "monte-carlo", targetIterations, estimatedStates, true, token));
    }
  };
  runChunk();
};
