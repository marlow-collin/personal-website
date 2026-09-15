function parseJsonObject(value, fallback = null) {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function publicSources(provenance) {
  const sources = Array.isArray(provenance?.sources) ? provenance.sources : [];
  return sources
    .filter((source) => source && typeof source === "object")
    .map((source) => ({
      id: String(source.id || ""),
      type: source.type ? String(source.type) : null,
      title: source.title ? String(source.title) : null,
      publisher: source.publisher ? String(source.publisher) : null,
      url: source.url ? String(source.url) : null,
      author: source.author ? String(source.author) : null,
      year: Number.isInteger(source.year) ? source.year : null,
      locator: source.locator ? String(source.locator) : null
    }))
    .filter((source) => source.id && source.title);
}

export function serializeDailyActivation(row, categorySlug) {
  const payload = parseJsonObject(row.payload_json, {});
  const provenance = parseJsonObject(row.provenance_json, {});

  return {
    state: "ready",
    category: categorySlug,
    date: row.local_date,
    timeZone: row.time_zone,
    content: {
      id: row.content_id,
      label: row.display_label,
      payload,
      sources: publicSources(provenance)
    }
  };
}
