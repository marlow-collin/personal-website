export const HAND_RANKINGS = Object.freeze([
  {
    rank: 10,
    name: "Royal Flush",
    strength: "Höchster Straight Flush",
    example: ["As", "Ks", "Qs", "Js", "10s"],
    build: "A–K–Q–J–10 in derselben Farbe.",
    tie: "Alle Royal Flushes sind gleich stark; der Pot wird geteilt."
  },
  {
    rank: 9,
    name: "Straight Flush",
    strength: "Fünf aufeinanderfolgende Karten, gleiche Farbe",
    example: ["9h", "8h", "7h", "6h", "5h"],
    build: "Straight und Flush gleichzeitig.",
    tie: "Die höchste Karte des Straight Flush entscheidet. A–2–3–4–5 zählt als 5-high."
  },
  {
    rank: 8,
    name: "Four of a Kind",
    strength: "Vier gleiche Ränge",
    example: ["Qc", "Qd", "Qh", "Qs", "9d"],
    build: "Vier Karten desselben Rangs plus eine Beikarte (Kicker).",
    tie: "Zuerst der Vierling, danach die Beikarte (Kicker)."
  },
  {
    rank: 7,
    name: "Full House",
    strength: "Drilling + Paar",
    example: ["Jh", "Jd", "Js", "8c", "8d"],
    build: "Drei Karten eines Rangs und zwei eines anderen.",
    tie: "Zuerst der Drilling; nur wenn dieser gleich ist, entscheidet das Paar."
  },
  {
    rank: 6,
    name: "Flush",
    strength: "Fünf Karten derselben Farbe",
    example: ["Ah", "Jh", "8h", "5h", "2h"],
    build: "Fünf Karten derselben Farbe; sie müssen nicht aufeinanderfolgen.",
    tie: "Die höchste Flush-Karte entscheidet, dann die nächste – bis alle fünf verglichen sind."
  },
  {
    rank: 5,
    name: "Straight",
    strength: "Fünf aufeinanderfolgende Ränge",
    example: ["9s", "8d", "7c", "6h", "5s"],
    build: "Fünf Ränge in Folge; Die Farben sind egal.",
    tie: "Nur die höchste Karte zählt. A–2–3–4–5 ist der niedrigste Straight."
  },
  {
    rank: 4,
    name: "Three of a Kind",
    strength: "Drei gleiche Ränge",
    example: ["7s", "7h", "7d", "Ac", "4c"],
    build: "Drilling plus zwei andere Karten.",
    tie: "Zuerst der Drilling, danach die beiden Beikarten (Kicker) in absteigender Reihenfolge."
  },
  {
    rank: 3,
    name: "Two Pair",
    strength: "Zwei verschiedene Paare",
    example: ["Ks", "Kh", "4d", "4c", "9s"],
    build: "Zwei Paare plus eine Beikarte (Kicker).",
    tie: "Höheres Paar, dann niedrigeres Paar, dann die Beikarte (Kicker)."
  },
  {
    rank: 2,
    name: "One Pair",
    strength: "Ein Paar",
    example: ["10s", "10h", "Ad", "7c", "3d"],
    build: "Zwei gleiche Ränge plus drei andere Karten.",
    tie: "Paar-Rang zuerst; danach alle drei Beikarten (Kicker) absteigend."
  },
  {
    rank: 1,
    name: "High Card",
    strength: "Keine andere Kombination",
    example: ["As", "Jd", "8c", "5h", "2s"],
    build: "Wenn kein Paar, Straight oder höher zustande kommt.",
    tie: "Höchste Karte, dann zweite, dritte, vierte und fünfte Karte vergleichen."
  }
]);
