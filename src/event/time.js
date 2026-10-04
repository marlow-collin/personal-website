const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseLocal(value) {
  const match = String(value || "").match(LOCAL_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year), month: Number(month), day: Number(day),
    hour: Number(hour), minute: Number(minute)
  };
}

function zonedParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const result = {};
  for (const part of parts) {
    if (part.type !== "literal") result[part.type] = Number(part.value);
  }
  return result;
}

function offsetMs(timestamp, timeZone) {
  const parts = zonedParts(timestamp, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second
  );
  return representedAsUtc - Math.floor(timestamp / 1000) * 1000;
}

export function zonedLocalToIso(localValue, timeZone) {
  const local = parseLocal(localValue);
  if (!local || !isValidTimeZone(timeZone)) return null;

  const target = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
  let guess = target;
  for (let i = 0; i < 4; i += 1) guess = target - offsetMs(guess, timeZone);

  const check = zonedParts(guess, timeZone);
  if (
    check.year !== local.year || check.month !== local.month || check.day !== local.day ||
    check.hour !== local.hour || check.minute !== local.minute
  ) return null;

  return new Date(guess).toISOString();
}

export function isoToLocalInput(isoValue, timeZone) {
  if (!isoValue || !isValidTimeZone(timeZone)) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date.getTime(), timeZone);
  const pad = value => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
