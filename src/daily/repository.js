const ACTIVATION_SELECT = `
  SELECT
    a.local_date,
    a.time_zone,
    a.content_id,
    c.display_label,
    c.payload_json,
    c.provenance_json
  FROM daily_activations a
  JOIN daily_content c ON c.id = a.content_id
  WHERE a.category_slug = ? AND a.local_date = ?
  LIMIT 1
`;

export async function getActivationForDate(db, categorySlug, localDate) {
  return db.prepare(ACTIVATION_SELECT).bind(categorySlug, localDate).first();
}

export async function getPreviousContentId(db, categorySlug) {
  const row = await db.prepare(`
    SELECT content_id
    FROM daily_activations
    WHERE category_slug = ?
    ORDER BY local_date DESC, activated_at DESC
    LIMIT 1
  `).bind(categorySlug).first();

  return row?.content_id || null;
}

export async function getMinimumActiveLevel(db, categorySlug) {
  const row = await db.prepare(`
    SELECT MIN(times_shown) AS min_level
    FROM daily_content
    WHERE category_slug = ? AND status = 'active'
  `).bind(categorySlug).first();

  return Number.isInteger(row?.min_level) ? row.min_level : null;
}

export async function chooseCandidate(db, categorySlug, minLevel, previousContentId) {
  const countRow = await db.prepare(`
    SELECT COUNT(*) AS candidate_count
    FROM daily_content
    WHERE category_slug = ? AND status = 'active' AND times_shown = ?
  `).bind(categorySlug, minLevel).first();

  const candidateCount = Number(countRow?.candidate_count || 0);
  if (candidateCount === 0) return null;

  if (previousContentId && candidateCount > 1) {
    const candidate = await db.prepare(`
      SELECT id
      FROM daily_content
      WHERE category_slug = ?
        AND status = 'active'
        AND times_shown = ?
        AND id <> ?
      ORDER BY RANDOM()
      LIMIT 1
    `).bind(categorySlug, minLevel, previousContentId).first();

    if (candidate?.id) return candidate.id;
  }

  const candidate = await db.prepare(`
    SELECT id
    FROM daily_content
    WHERE category_slug = ? AND status = 'active' AND times_shown = ?
    ORDER BY RANDOM()
    LIMIT 1
  `).bind(categorySlug, minLevel).first();

  return candidate?.id || null;
}

export async function claimActivation({
  db,
  categorySlug,
  localDate,
  timeZone,
  contentId,
  selectionLevel,
  activationId,
  activationToken
}) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO daily_activations (
      id,
      category_slug,
      local_date,
      content_id,
      selection_level,
      activation_token,
      time_zone
    )
    SELECT ?, ?, ?, c.id, ?, ?, ?
    FROM daily_content c
    WHERE c.id = ?
      AND c.category_slug = ?
      AND c.status = 'active'
      AND c.times_shown = ?
  `).bind(
    activationId,
    categorySlug,
    localDate,
    selectionLevel,
    activationToken,
    timeZone,
    contentId,
    categorySlug,
    selectionLevel
  );

  const increment = db.prepare(`
    UPDATE daily_content
    SET times_shown = times_shown + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND EXISTS (
        SELECT 1
        FROM daily_activations
        WHERE activation_token = ?
          AND content_id = ?
      )
  `).bind(contentId, activationToken, contentId);

  await db.batch([insert, increment]);
}
