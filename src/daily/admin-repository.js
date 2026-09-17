import { DAILY_CATEGORY_LIST, getDailyCategory } from "./config.js";
import { canonicalDedupeText, displayLabelFor, normalizeDedupeText, validateImportDocument } from "./import-validation.js";

const encoder = new TextEncoder();

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function parseJson(value, fallback = null) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function sha256Hex(value) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(String(value || "")));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serializeContent(row) {
  if (!row) return null;
  return {
    id: row.id,
    categorySlug: row.category_slug,
    status: row.status,
    timesShown: Number(row.times_shown || 0),
    displayLabel: row.display_label,
    payloadSchemaVersion: Number(row.payload_schema_version || 1),
    payload: parseJson(row.payload_json, {}),
    provenance: parseJson(row.provenance_json, null),
    importBatchId: row.import_batch_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getDailyAdminOverview(db) {
  const [contentResult, rotationResult, lastResult] = await Promise.all([
    db.prepare(`
      SELECT category_slug,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
             SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived_count
      FROM daily_content GROUP BY category_slug
    `).all(),
    db.prepare(`
      SELECT c.category_slug,
             MIN(c.times_shown) AS rotation_level,
             SUM(CASE WHEN c.times_shown = (
               SELECT MIN(c2.times_shown) FROM daily_content c2
               WHERE c2.category_slug = c.category_slug AND c2.status = 'active'
             ) THEN 1 ELSE 0 END) AS remaining_count
      FROM daily_content c
      WHERE c.status = 'active'
      GROUP BY c.category_slug
    `).all(),
    db.prepare(`
      SELECT a.category_slug, a.local_date, a.activated_at, c.display_label, c.id AS content_id
      FROM daily_activations a
      JOIN daily_content c ON c.id = a.content_id
      WHERE a.id = (
        SELECT a2.id FROM daily_activations a2
        WHERE a2.category_slug = a.category_slug
        ORDER BY a2.local_date DESC, a2.activated_at DESC LIMIT 1
      )
    `).all()
  ]);

  const counts = new Map(rows(contentResult).map((row) => [row.category_slug, row]));
  const rotations = new Map(rows(rotationResult).map((row) => [row.category_slug, row]));
  const last = new Map(rows(lastResult).map((row) => [row.category_slug, row]));

  return {
    categories: DAILY_CATEGORY_LIST.map((category) => {
      const count = counts.get(category.slug) || {};
      const rotation = rotations.get(category.slug) || {};
      const latest = last.get(category.slug) || null;
      return {
        slug: category.slug,
        label: category.label,
        shortLabel: category.shortLabel,
        active: Number(count.active_count || 0),
        archived: Number(count.archived_count || 0),
        rotationLevel: rotation.rotation_level == null ? null : Number(rotation.rotation_level),
        remaining: Number(rotation.remaining_count || 0),
        lastShown: latest ? {
          localDate: latest.local_date,
          activatedAt: latest.activated_at,
          contentId: latest.content_id,
          displayLabel: latest.display_label
        } : null
      };
    })
  };
}

export async function listDailyContent(db, { category = "", status = "", search = "", limit = 200 } = {}) {
  const clauses = [];
  const values = [];
  if (category) { clauses.push("category_slug = ?"); values.push(category); }
  if (status) { clauses.push("status = ?"); values.push(status); }
  if (search) { clauses.push("LOWER(display_label) LIKE ?"); values.push(`%${search.toLocaleLowerCase("de-DE")}%`); }
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 200));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.prepare(`
    SELECT id, category_slug, status, times_shown, display_label, payload_schema_version,
           payload_json, provenance_json, import_batch_id, created_at, updated_at
    FROM daily_content
    ${where}
    ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(...values, safeLimit).all();
  return rows(result).map(serializeContent);
}

export async function getDailyContent(db, id) {
  const row = await db.prepare(`
    SELECT id, category_slug, status, times_shown, display_label, payload_schema_version,
           payload_json, provenance_json, import_batch_id, created_at, updated_at
    FROM daily_content WHERE id = ? LIMIT 1
  `).bind(id).first();
  return serializeContent(row);
}

async function prepareEditableContent({ categorySlug, payload, provenance, status = "active" }) {
  const category = getDailyCategory(categorySlug);
  if (!category) return { error: "Unknown Daily category" };
  if (!["active", "archived"].includes(status)) return { error: "Status must be active or archived" };

  const document = {
    format: "daily-content-import",
    format_version: 1,
    category: categorySlug,
    payload_schema_version: 1,
    defaults: { status, initial_times_shown: { mode: "match_current_pool" } },
    items: [{ client_ref: "admin-editor", payload, provenance, status }]
  };
  const validation = validateImportDocument(document);
  if (validation.errors.length) {
    return { error: "Content validation failed", validation: { errors: validation.errors, warnings: validation.warnings } };
  }
  const normalized = normalizeDedupeText(canonicalDedupeText(categorySlug, payload));
  return {
    category,
    displayLabel: displayLabelFor(categorySlug, payload),
    dedupeKey: await sha256Hex(normalized),
    payloadJson: JSON.stringify(payload),
    provenanceJson: provenance == null ? null : JSON.stringify(provenance),
    warnings: validation.warnings
  };
}

export async function createDailyContent(db, input) {
  const prepared = await prepareEditableContent(input);
  if (prepared.error) return prepared;
  const duplicate = await db.prepare(`SELECT id FROM daily_content WHERE category_slug = ? AND dedupe_key = ? LIMIT 1`)
    .bind(input.categorySlug, prepared.dedupeKey).first();
  if (duplicate?.id) return { error: "An exact duplicate already exists in this category", duplicateId: duplicate.id };

  const min = await db.prepare(`SELECT MIN(times_shown) AS min_level FROM daily_content WHERE category_slug = ? AND status = 'active'`)
    .bind(input.categorySlug).first();
  const timesShown = Number.isInteger(min?.min_level) ? min.min_level : 0;
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO daily_content (
      id, category_slug, status, times_shown, display_label, payload_schema_version,
      payload_json, provenance_json, dedupe_key, import_batch_id
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, NULL)
  `).bind(id, input.categorySlug, input.status || "active", timesShown, prepared.displayLabel, prepared.payloadJson, prepared.provenanceJson, prepared.dedupeKey).run();
  return { item: await getDailyContent(db, id), warnings: prepared.warnings };
}

export async function updateDailyContent(db, id, input) {
  const existing = await getDailyContent(db, id);
  if (!existing) return { error: "Daily content not found", status: 404 };
  const categorySlug = input.categorySlug || existing.categorySlug;
  const status = input.status || existing.status;
  const prepared = await prepareEditableContent({ categorySlug, status, payload: input.payload, provenance: input.provenance });
  if (prepared.error) return prepared;
  const duplicate = await db.prepare(`SELECT id FROM daily_content WHERE category_slug = ? AND dedupe_key = ? AND id <> ? LIMIT 1`)
    .bind(categorySlug, prepared.dedupeKey, id).first();
  if (duplicate?.id) return { error: "An exact duplicate already exists in this category", duplicateId: duplicate.id };

  await db.prepare(`
    UPDATE daily_content
    SET category_slug = ?, status = ?, display_label = ?, payload_schema_version = 1,
        payload_json = ?, provenance_json = ?, dedupe_key = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(categorySlug, status, prepared.displayLabel, prepared.payloadJson, prepared.provenanceJson, prepared.dedupeKey, id).run();
  return { item: await getDailyContent(db, id), warnings: prepared.warnings };
}

export async function setDailyContentStatus(db, id, status) {
  if (!["active", "archived"].includes(status)) return { error: "Status must be active or archived" };
  const existing = await getDailyContent(db, id);
  if (!existing) return { error: "Daily content not found", status: 404 };
  await db.prepare(`UPDATE daily_content SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(status, id).run();
  return { item: await getDailyContent(db, id) };
}

export async function listDailyHistory(db, { category = "", date = "", limit = 200 } = {}) {
  const clauses = [];
  const values = [];
  if (category) { clauses.push("a.category_slug = ?"); values.push(category); }
  if (date) { clauses.push("a.local_date = ?"); values.push(date); }
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 200));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.prepare(`
    SELECT a.id, a.category_slug, a.local_date, a.selection_level, a.time_zone, a.activated_at,
           c.id AS content_id, c.status AS content_status, c.times_shown, c.display_label,
           c.payload_json, c.provenance_json
    FROM daily_activations a
    JOIN daily_content c ON c.id = a.content_id
    ${where}
    ORDER BY a.local_date DESC, a.activated_at DESC
    LIMIT ?
  `).bind(...values, safeLimit).all();
  return rows(result).map((row) => ({
    id: row.id,
    categorySlug: row.category_slug,
    localDate: row.local_date,
    selectionLevel: Number(row.selection_level || 0),
    timeZone: row.time_zone,
    activatedAt: row.activated_at,
    content: {
      id: row.content_id,
      status: row.content_status,
      timesShown: Number(row.times_shown || 0),
      displayLabel: row.display_label,
      payload: parseJson(row.payload_json, {}),
      provenance: parseJson(row.provenance_json, null)
    }
  }));
}
