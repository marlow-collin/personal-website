import { DAILY_TIME_ZONE } from "./config.js";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: DAILY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function getDailyLocalDate(now = new Date()) {
  const parts = DATE_FORMATTER.formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getDailyTimeZone() {
  return DAILY_TIME_ZONE;
}
