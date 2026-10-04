const EVENT_FIELDS = `
  id, slug, title, eyebrow, subtitle, description, closing_message, theme, icon,
  start_at, end_at, timezone, location_label, location_url,
  primary_cta_label, primary_cta_url, details_json, links_json,
  is_active, created_at, updated_at
`;

export async function listEvents(env) {
  const result = await env.EVENTS_DB.prepare(`
    SELECT ${EVENT_FIELDS}
    FROM events
    ORDER BY is_active DESC,
      CASE WHEN datetime(start_at) >= CURRENT_TIMESTAMP THEN 0 ELSE 1 END,
      start_at ASC
  `).all();
  return result.results || [];
}

export async function getEventById(env, id) {
  return env.EVENTS_DB.prepare(`SELECT ${EVENT_FIELDS} FROM events WHERE id = ?`).bind(id).first();
}

export async function getEventBySlug(env, slug, activeOnly = true) {
  const activeClause = activeOnly ? "AND is_active = 1" : "";
  return env.EVENTS_DB.prepare(`SELECT ${EVENT_FIELDS} FROM events WHERE slug = ? ${activeClause}`).bind(slug).first();
}

export async function slugExists(env, slug, excludeId = null) {
  if (excludeId == null) {
    return Boolean(await env.EVENTS_DB.prepare("SELECT 1 FROM events WHERE slug = ? LIMIT 1").bind(slug).first());
  }
  return Boolean(await env.EVENTS_DB.prepare("SELECT 1 FROM events WHERE slug = ? AND id <> ? LIMIT 1").bind(slug, excludeId).first());
}

export async function createEvent(env, event) {
  const result = await env.EVENTS_DB.prepare(`
    INSERT INTO events (
      slug, title, eyebrow, subtitle, description, closing_message, theme, icon,
      start_at, end_at, timezone, location_label, location_url,
      primary_cta_label, primary_cta_url, details_json, links_json, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.slug, event.title, event.eyebrow, event.subtitle, event.description,
    event.closingMessage, event.theme, event.icon, event.startAt, event.endAt,
    event.timezone, event.locationLabel, event.locationUrl,
    event.primaryCtaLabel, event.primaryCtaUrl,
    JSON.stringify(event.details), JSON.stringify(event.links), event.isActive ? 1 : 0
  ).run();
  return getEventById(env, result.meta.last_row_id);
}

export async function updateEvent(env, id, event) {
  await env.EVENTS_DB.prepare(`
    UPDATE events SET
      slug = ?, title = ?, eyebrow = ?, subtitle = ?, description = ?, closing_message = ?,
      theme = ?, icon = ?, start_at = ?, end_at = ?, timezone = ?,
      location_label = ?, location_url = ?, primary_cta_label = ?, primary_cta_url = ?,
      details_json = ?, links_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    event.slug, event.title, event.eyebrow, event.subtitle, event.description,
    event.closingMessage, event.theme, event.icon, event.startAt, event.endAt,
    event.timezone, event.locationLabel, event.locationUrl,
    event.primaryCtaLabel, event.primaryCtaUrl,
    JSON.stringify(event.details), JSON.stringify(event.links), event.isActive ? 1 : 0,
    id
  ).run();
  return getEventById(env, id);
}

export async function deleteEvent(env, id) {
  return env.EVENTS_DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
}
