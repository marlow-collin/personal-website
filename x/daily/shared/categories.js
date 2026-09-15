export const DAILY_TIME_ZONE = "Europe/Berlin";

const GROUPS = Object.freeze({
  thoughts: Object.freeze({ id: "thoughts", label: "Sprache & Gedanken", accent: "thoughts" }),
  knowledge: Object.freeze({ id: "knowledge", label: "Wissen & Entdecken", accent: "knowledge" }),
  playful: Object.freeze({ id: "playful", label: "Humor & Abenteuer", accent: "playful" }),
  mood: Object.freeze({ id: "mood", label: "Stimmung & Kultur", accent: "mood" })
});

function category(definition) {
  return Object.freeze({
    payloadSchemaVersion: 1,
    ...definition,
    icon: Object.freeze(definition.icon)
  });
}

export const DAILY_CATEGORY_LIST = Object.freeze([
  category({
    slug: "quote",
    label: "Zitat des Tages",
    shortLabel: "Zitat",
    description: "Ein belegtes Zitat mit Kontext und kurzer Einordnung.",
    group: "thoughts",
    renderer: "statement",
    transition: "quote",
    icon: { svg: "/x/daily/icons/quote.svg", emoji: "💬" }
  }),
  category({
    slug: "saying",
    label: "Spruch des Tages",
    shortLabel: "Spruch",
    description: "Ein kurzer Spruch und – wenn nötig – seine Bedeutung.",
    group: "thoughts",
    renderer: "statement",
    transition: "saying",
    icon: { svg: "/x/daily/icons/saying.svg", emoji: "✨" }
  }),
  category({
    slug: "wisdom",
    label: "Weisheit des Tages",
    shortLabel: "Weisheit",
    description: "Ein Gedanke mit etwas mehr Tiefe und Einordnung.",
    group: "thoughts",
    renderer: "statement",
    transition: "wisdom",
    icon: { svg: "/x/daily/icons/wisdom.svg", emoji: "🎓" }
  }),
  category({
    slug: "word",
    label: "Wort des Tages",
    shortLabel: "Wort",
    description: "Ein Wort, seine Bedeutung und ein Beispiel im Kontext.",
    group: "thoughts",
    renderer: "language",
    transition: "word",
    icon: { svg: "/x/daily/icons/word.svg", emoji: "🔤" }
  }),
  category({
    slug: "idiom",
    label: "Redewendung des Tages",
    shortLabel: "Redewendung",
    description: "Eine Redewendung von der wörtlichen zur eigentlichen Bedeutung.",
    group: "thoughts",
    renderer: "language",
    transition: "idiom",
    icon: { svg: "/x/daily/icons/idiom.svg", emoji: "💭" }
  }),
  category({
    slug: "fact",
    label: "Fakt des Tages",
    shortLabel: "Fakt",
    description: "Ein überprüfbarer Fakt – kurz erklärt und mit Quellen belegt.",
    group: "knowledge",
    renderer: "knowledge",
    transition: "fact",
    icon: { svg: "/x/daily/icons/fact.svg", emoji: "ℹ️" }
  }),
  category({
    slug: "fun-fact",
    label: "Fun Fact des Tages",
    shortLabel: "Fun Fact",
    description: "Ein überraschender, belegter Fakt mit etwas mehr Spielfreude.",
    group: "knowledge",
    renderer: "knowledge",
    transition: "fun-fact",
    icon: { svg: null, emoji: "💡" }
  }),
  category({
    slug: "today-i-learned",
    label: "Heute gelernt",
    shortLabel: "Heute gelernt",
    description: "Ein kleiner Mini-Explainer zu etwas, das man gern weitererzählt.",
    group: "knowledge",
    renderer: "knowledge",
    transition: "today-i-learned",
    icon: { svg: "/x/daily/icons/today-i-learned.svg", emoji: "🧠" }
  }),
  category({
    slug: "feel-good-fact",
    label: "Feel-Good Fact",
    shortLabel: "Feel-Good Fact",
    description: "Ein belegter Fakt, der die Welt kurz etwas freundlicher wirken lässt.",
    group: "knowledge",
    renderer: "knowledge",
    transition: "feel-good-fact",
    icon: { svg: null, emoji: "🦦" }
  }),
  category({
    slug: "joke",
    label: "Witz des Tages",
    shortLabel: "Witz",
    description: "Ein Witz – manchmal direkt, manchmal mit Pointe zum Aufdecken.",
    group: "playful",
    renderer: "comedy",
    transition: "joke",
    icon: { svg: "/x/daily/icons/joke.svg", emoji: "😂" }
  }),
  category({
    slug: "bad-advice",
    label: "Schlechter Rat des Tages",
    shortLabel: "Schlechter Rat",
    description: "Absichtlich schlechter Rat. Bitte wirklich nicht machen.",
    group: "playful",
    renderer: "comedy",
    transition: "bad-advice",
    icon: { svg: "/x/daily/icons/bad-advice.svg", emoji: "⚠️" }
  }),
  category({
    slug: "excuse",
    label: "Ausrede des Tages",
    shortLabel: "Excuse",
    description: "Eine neue, nicht ganz ernst gemeinte Ausrede für den Tag.",
    group: "playful",
    renderer: "comedy",
    transition: "excuse",
    icon: { svg: null, emoji: "😅" }
  }),
  category({
    slug: "side-quest",
    label: "Side Quest des Tages",
    shortLabel: "Side Quest",
    description: "Eine kleine, machbare Nebenmission für zwischendurch.",
    group: "playful",
    renderer: "side-quest",
    transition: "side-quest",
    icon: { svg: "/x/daily/icons/side-quest.svg", emoji: "🧭" }
  }),
  category({
    slug: "cheer-me-up",
    label: "Cheer Me Up",
    shortLabel: "Cheer Me Up",
    description: "Ein kleiner Impuls für einen etwas besseren Moment.",
    group: "mood",
    renderer: "cheer",
    transition: "cheer-me-up",
    icon: { svg: "/x/daily/icons/cheer-me-up.svg", emoji: "☀️" }
  }),
  category({
    slug: "worth-remembering",
    label: "Worth Remembering",
    shortLabel: "Worth Remembering",
    description: "Ein Gedanke, den es sich lohnt, noch etwas länger mitzunehmen.",
    group: "mood",
    renderer: "statement",
    transition: "worth-remembering",
    icon: { svg: "/x/daily/icons/worth-remembering.svg", emoji: "🫶" }
  }),
  category({
    slug: "media-quote",
    label: "Media Quote des Tages",
    shortLabel: "Media Quote",
    description: "Eine kurze Zeile aus Film, Serie, Game oder Song – mit Kontext.",
    group: "mood",
    renderer: "statement",
    transition: "media-quote",
    icon: { svg: "/x/daily/icons/media-quote.svg", emoji: "🎬" }
  })
]);

export const DAILY_CATEGORIES = Object.freeze(
  Object.fromEntries(DAILY_CATEGORY_LIST.map((item) => [item.slug, item]))
);

export const DAILY_GROUPS = GROUPS;

export function getDailyCategory(slug) {
  return DAILY_CATEGORIES[String(slug || "")] || null;
}
