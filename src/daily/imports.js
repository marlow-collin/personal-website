import { canonicalDedupeText, displayLabelFor, normalizeDedupeText, validateImportDocument } from "./import-validation.js";

const encoder = new TextEncoder();

async function sha256Hex(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2,"0")).join("");
}

async function prepareItems(document, validation) {
  const result=[];
  for (const entry of validation.items) {
    const normalized = normalizeDedupeText(canonicalDedupeText(document.category, entry.item.payload));
    result.push({ ...entry, dedupeKey: await sha256Hex(normalized), displayLabel: displayLabelFor(document.category, entry.item.payload) });
  }
  return result;
}

async function findExistingKeys(db, categorySlug, items) {
  if (!items.length) return new Set();
  const statements = items.map((item) => db.prepare(`SELECT dedupe_key FROM daily_content WHERE category_slug = ? AND dedupe_key = ? LIMIT 1`).bind(categorySlug,item.dedupeKey));
  const rows = await db.batch(statements);
  const found = new Set();
  rows.forEach((result,index) => { if (result?.results?.length) found.add(items[index].dedupeKey); });
  return found;
}

function withinFileDuplicates(items) {
  const seen=new Map(), duplicateIndexes=new Set();
  for (const item of items) {
    if (seen.has(item.dedupeKey)) { duplicateIndexes.add(item.index); duplicateIndexes.add(seen.get(item.dedupeKey)); }
    else seen.set(item.dedupeKey,item.index);
  }
  return duplicateIndexes;
}

export async function validateImport(db, document) {
  const validation=validateImportDocument(document);
  if (validation.errors.length) return { ok:false, category:document?.category || null, errors:validation.errors, warnings:validation.warnings, summary:{ total:Array.isArray(document?.items)?document.items.length:0, valid:0, duplicates:0 } };
  const prepared=await prepareItems(document,validation);
  const within=withinFileDuplicates(prepared);
  const existing=await findExistingKeys(db,document.category,prepared);
  const duplicateErrors=[];
  for (const item of prepared) {
    if (within.has(item.index)) duplicateErrors.push({ code:"duplicate_in_file", path:`items[${item.index}]`, message:"Exaktes Duplikat innerhalb dieser Importdatei.", clientRef:item.clientRef });
    if (existing.has(item.dedupeKey)) duplicateErrors.push({ code:"duplicate_in_database", path:`items[${item.index}]`, message:"Exaktes Duplikat existiert bereits in D1.", clientRef:item.clientRef });
  }
  const errors=[...validation.errors,...duplicateErrors];
  return {
    ok: errors.length === 0,
    category: document.category,
    errors,
    warnings: validation.warnings,
    summary: { total: prepared.length, valid: prepared.length - new Set(duplicateErrors.map((e)=>e.path)).size, duplicates: new Set(duplicateErrors.map((e)=>e.path)).size },
    preview: prepared.map((item)=>({ index:item.index, clientRef:item.clientRef, displayLabel:item.displayLabel, status:item.item.status || document.defaults.status || "active", duplicate:within.has(item.index)||existing.has(item.dedupeKey) }))
  };
}

async function currentPoolMinimum(db, categorySlug) {
  const row=await db.prepare(`SELECT MIN(times_shown) AS min_level FROM daily_content WHERE category_slug = ? AND status = 'active'`).bind(categorySlug).first();
  return Number.isInteger(row?.min_level) ? row.min_level : 0;
}

function resolveTimesShown(spec, fallback, poolMin) {
  const value=spec || fallback;
  return value?.mode === "manual" ? value.value : poolMin;
}

export async function commitImport(db, document, sourceFilename = "admin2-paste.json") {
  const preview=await validateImport(db,document);
  if (!preview.ok) return { ...preview, committed:false };

  const validation=validateImportDocument(document);
  const prepared=await prepareItems(document,validation);
  const poolMin=await currentPoolMinimum(db,document.category);
  const importId=crypto.randomUUID();
  const raw=JSON.stringify(document);
  const sourceHash=await sha256Hex(raw);
  const defaultTimes=document.defaults.initial_times_shown;
  const requestedTimes=defaultTimes.mode === "manual" ? defaultTimes.value : null;
  const resolvedDefault=resolveTimesShown(defaultTimes,defaultTimes,poolMin);

  const statements=[];
  statements.push(db.prepare(`
    INSERT INTO daily_imports (
      id, category_slug, source_filename, source_file_hash, format_version, payload_schema_version,
      times_shown_mode, requested_times_shown, resolved_times_shown,
      total_items, imported_items, duplicate_items, rejected_items
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `).bind(importId,document.category,sourceFilename,sourceHash,document.format_version,document.payload_schema_version,defaultTimes.mode,requestedTimes,resolvedDefault,prepared.length,prepared.length));

  for (const item of prepared) {
    const timesShown=resolveTimesShown(item.item.initial_times_shown,defaultTimes,poolMin);
    statements.push(db.prepare(`
      INSERT INTO daily_content (
        id, category_slug, status, times_shown, display_label, payload_schema_version,
        payload_json, provenance_json, dedupe_key, import_batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), document.category, item.item.status || document.defaults.status || "active", timesShown,
      item.displayLabel, document.payload_schema_version, JSON.stringify(item.item.payload),
      item.item.provenance == null ? null : JSON.stringify(item.item.provenance), item.dedupeKey, importId
    ));
  }

  await db.batch(statements);
  return { committed:true, ok:true, category:document.category, importId, imported:prepared.length, resolvedPoolMinimum:poolMin, warnings:preview.warnings };
}
