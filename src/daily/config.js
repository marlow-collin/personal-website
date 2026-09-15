export const DAILY_TIME_ZONE = "Europe/Berlin";

export const DAILY_CATEGORIES = Object.freeze({
  fact: Object.freeze({
    slug: "fact",
    label: "Fakt des Tages",
    payloadSchemaVersion: 1
  })
});

export function getDailyCategory(slug) {
  return DAILY_CATEGORIES[String(slug || "")] || null;
}
