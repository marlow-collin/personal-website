import { getDailyCategory } from "./config.js";

const TOP_KEYS = ["format", "format_version", "category", "payload_schema_version", "defaults", "items"];
const ITEM_KEYS = ["client_ref", "payload", "provenance", "status", "initial_times_shown"];
const STATUS_VALUES = new Set(["active", "archived"]);
const SOURCE_TYPES = new Set(["web", "book", "media", "journal", "paper", "database", "archive", "other"]);
const MAX_ITEMS = 250;

function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
function isNonEmptyString(value) { return typeof value === "string" && value.trim().length > 0; }
function pathJoin(base, key) { return base ? `${base}.${key}` : key; }
function issue(code, path, message, clientRef = null) { return { code, path, message, clientRef }; }
function allowedKeys(value, allowed, path, errors, clientRef = null) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(issue("unknown_field", pathJoin(path, key), `Unbekanntes Feld: ${key}`, clientRef));
}
function requireString(value, path, errors, clientRef = null) {
  if (!isNonEmptyString(value)) errors.push(issue("required_string", path, "Pflichtfeld muss ein nicht-leerer String sein.", clientRef));
}
function optionalString(value, path, errors, clientRef = null) {
  if (value !== null && value !== undefined && typeof value !== "string") errors.push(issue("string_or_null", path, "Feld muss String oder null sein.", clientRef));
}
function requireArray(value, path, errors, clientRef = null, nonEmpty = false) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) errors.push(issue("required_array", path, nonEmpty ? "Pflichtfeld muss ein nicht-leeres Array sein." : "Feld muss ein Array sein.", clientRef));
}


function validateTimesShown(value, path, errors, clientRef = null) {
  if (!isObject(value)) { errors.push(issue("times_shown", path, "initial_times_shown muss ein Objekt sein.", clientRef)); return; }
  allowedKeys(value, ["mode", "value"], path, errors, clientRef);
  if (value.mode === "match_current_pool") {
    if ("value" in value && value.value !== null) errors.push(issue("times_shown_value", `${path}.value`, "Bei match_current_pool darf kein value gesetzt sein.", clientRef));
    return;
  }
  if (value.mode === "manual") {
    if (!Number.isInteger(value.value) || value.value < 0) errors.push(issue("times_shown_value", `${path}.value`, "Manual value muss eine ganze Zahl >= 0 sein.", clientRef));
    return;
  }
  errors.push(issue("times_shown_mode", `${path}.mode`, "mode muss match_current_pool oder manual sein.", clientRef));
}

function validateLanguageTranslation(language, translation, path, errors, clientRef) {
  requireString(language, `${path}.language`, errors, clientRef);
  if (language === "de") {
    if (translation !== null && translation !== undefined && translation !== "") errors.push(issue("translation_de", `${path}.translation_de`, "Bei deutschem Original soll translation_de null sein.", clientRef));
  } else if (!isNonEmptyString(translation)) {
    errors.push(issue("translation_de", `${path}.translation_de`, "Bei nicht-deutschem Original ist translation_de erforderlich.", clientRef));
  }
}

function validateSourceRefs(refs, path, sourceIds, errors, clientRef, required = true) {
  if (!Array.isArray(refs) || (required && refs.length === 0)) {
    errors.push(issue("source_refs", path, required ? "Mindestens eine source_ref ist erforderlich." : "source_refs muss ein Array sein.", clientRef));
    return;
  }
  for (const [index, ref] of refs.entries()) {
    if (!isNonEmptyString(ref)) errors.push(issue("source_ref", `${path}[${index}]`, "source_ref muss ein String sein.", clientRef));
    else if (!sourceIds.has(ref)) errors.push(issue("source_ref_missing", `${path}[${index}]`, `Quelle ${ref} existiert in diesem Eintrag nicht.`, clientRef));
  }
}

function validateProvenance(value, path, errors, warnings, clientRef, required) {
  if (value === null || value === undefined) {
    if (required) errors.push(issue("provenance_required", path, "Für diese Kategorie sind Quellen erforderlich.", clientRef));
    return new Set();
  }
  if (!isObject(value)) { errors.push(issue("provenance", path, "provenance muss Objekt oder null sein.", clientRef)); return new Set(); }
  allowedKeys(value, ["sources", "verification"], path, errors, clientRef);
  if (!Array.isArray(value.sources) || (required && value.sources.length === 0)) {
    errors.push(issue("sources", `${path}.sources`, "sources muss ein nicht-leeres Array sein.", clientRef));
    return new Set();
  }
  const ids = new Set();
  for (const [index, source] of value.sources.entries()) {
    const p = `${path}.sources[${index}]`;
    if (!isObject(source)) { errors.push(issue("source", p, "Quelle muss ein Objekt sein.", clientRef)); continue; }
    allowedKeys(source, ["id", "type", "title", "publisher", "url", "author", "year", "locator"], p, errors, clientRef);
    requireString(source.id, `${p}.id`, errors, clientRef);
    requireString(source.type, `${p}.type`, errors, clientRef);
    requireString(source.title, `${p}.title`, errors, clientRef);
    optionalString(source.publisher, `${p}.publisher`, errors, clientRef);
    optionalString(source.url, `${p}.url`, errors, clientRef);
    optionalString(source.author, `${p}.author`, errors, clientRef);
    optionalString(source.locator, `${p}.locator`, errors, clientRef);
    if (isNonEmptyString(source.type) && !SOURCE_TYPES.has(source.type)) errors.push(issue("source_type", `${p}.type`, "source.type ist nicht erlaubt.", clientRef));
    if (source.type === "web" && !/^https:\/\//i.test(String(source.url || ""))) errors.push(issue("source_url", `${p}.url`, "Web-Quelle benötigt eine https:// URL.", clientRef));
    if (source.year !== null && source.year !== undefined && (!Number.isInteger(source.year) || source.year < 0 || source.year > 2200)) errors.push(issue("source_year", `${p}.year`, "year muss null oder eine plausible ganze Zahl sein.", clientRef));
    if (ids.has(source.id)) errors.push(issue("source_id_duplicate", `${p}.id`, `Doppelte Source-ID ${source.id}.`, clientRef));
    if (isNonEmptyString(source.id)) ids.add(source.id);
  }
  if (value.verification !== null && value.verification !== undefined) {
    if (!isObject(value.verification)) errors.push(issue("verification", `${path}.verification`, "verification muss Objekt oder null sein.", clientRef));
    else {
      allowedKeys(value.verification, ["verified", "note"], `${path}.verification`, errors, clientRef);
      if (typeof value.verification.verified !== "boolean") errors.push(issue("verified", `${path}.verification.verified`, "verified muss true/false sein.", clientRef));
      optionalString(value.verification.note, `${path}.verification.note`, errors, clientRef);
      if (required && value.verification.verified !== true) errors.push(issue("verification_required", `${path}.verification.verified`, "Sourced Content muss als verified:true markiert sein.", clientRef));
    }
  } else if (required) errors.push(issue("verification_required", `${path}.verification`, "verification ist für sourced Content erforderlich.", clientRef));
  return ids;
}

function validateOriginal(obj, path, errors, clientRef) {
  if (!isObject(obj)) { errors.push(issue("original", path, "original muss ein Objekt sein.", clientRef)); return; }
  allowedKeys(obj, ["text", "language"], path, errors, clientRef);
  requireString(obj.text, `${path}.text`, errors, clientRef);
  requireString(obj.language, `${path}.language`, errors, clientRef);
}

function validateFactPayload(payload, base, errors, sourceIds, clientRef) {
  allowedKeys(payload, ["fact", "explanation"], base, errors, clientRef);
  for (const key of ["fact", "explanation"]) {
    const value = payload[key]; const path = `${base}.${key}`;
    if (!isObject(value)) { errors.push(issue("section", path, `${key} muss ein Objekt sein.`, clientRef)); continue; }
    allowedKeys(value, ["text", "source_refs"], path, errors, clientRef);
    requireString(value.text, `${path}.text`, errors, clientRef);
    validateSourceRefs(value.source_refs, `${path}.source_refs`, sourceIds, errors, clientRef, true);
  }
}

function validatePayload(category, payload, base, errors, warnings, sourceIds, clientRef) {
  if (!isObject(payload)) { errors.push(issue("payload", base, "payload muss ein Objekt sein.", clientRef)); return; }
  const s = category.slug;
  if (["fact", "fun-fact", "feel-good-fact"].includes(s)) return validateFactPayload(payload, base, errors, sourceIds, clientRef);

  if (s === "quote") {
    allowedKeys(payload, ["original","translation_de","attribution","work","meaning","context","about_attribution","source_refs"], base, errors, clientRef);
    validateOriginal(payload.original, `${base}.original`, errors, clientRef);
    validateLanguageTranslation(payload?.original?.language, payload.translation_de, base, errors, clientRef);
    if (!isObject(payload.attribution)) errors.push(issue("attribution", `${base}.attribution`, "attribution muss Objekt sein.", clientRef));
    else { allowedKeys(payload.attribution,["name","type"],`${base}.attribution`,errors,clientRef); requireString(payload.attribution.name,`${base}.attribution.name`,errors,clientRef); if (!["real_person","fictional_character"].includes(payload.attribution.type)) errors.push(issue("attribution_type",`${base}.attribution.type`,"type muss real_person oder fictional_character sein.",clientRef)); }
    if (payload.work !== null && payload.work !== undefined) { if (!isObject(payload.work)) errors.push(issue("work",`${base}.work`,"work muss Objekt oder null sein.",clientRef)); else { allowedKeys(payload.work,["title","type","year"],`${base}.work`,errors,clientRef); optionalString(payload.work.title,`${base}.work.title`,errors,clientRef); optionalString(payload.work.type,`${base}.work.type`,errors,clientRef); if (payload.work.year !== null && payload.work.year !== undefined && !Number.isInteger(payload.work.year)) errors.push(issue("year",`${base}.work.year`,"year muss integer oder null sein.",clientRef)); }}
    requireString(payload.meaning, `${base}.meaning`, errors, clientRef); requireString(payload.about_attribution, `${base}.about_attribution`, errors, clientRef); optionalString(payload.context,`${base}.context`,errors,clientRef); validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); return;
  }
  if (s === "saying") {
    allowedKeys(payload,["text","language","translation_de","meaning","tone","attribution","source_refs"],base,errors,clientRef); requireString(payload.text,`${base}.text`,errors,clientRef); validateLanguageTranslation(payload.language,payload.translation_de,base,errors,clientRef); optionalString(payload.meaning,`${base}.meaning`,errors,clientRef); optionalString(payload.tone,`${base}.tone`,errors,clientRef); if (payload.attribution !== null && payload.attribution !== undefined && !isObject(payload.attribution)) errors.push(issue("attribution",`${base}.attribution`,"attribution muss Objekt oder null sein.",clientRef)); else if (payload.attribution) { allowedKeys(payload.attribution,["name","type"],`${base}.attribution`,errors,clientRef); requireString(payload.attribution.name,`${base}.attribution.name`,errors,clientRef); optionalString(payload.attribution.type,`${base}.attribution.type`,errors,clientRef); } if (payload.attribution) validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); else if (payload.source_refs !== undefined) validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,false); return;
  }
  if (s === "wisdom") {
    allowedKeys(payload,["text","language","translation_de","meaning","origin","source_refs"],base,errors,clientRef); requireString(payload.text,`${base}.text`,errors,clientRef); validateLanguageTranslation(payload.language,payload.translation_de,base,errors,clientRef); requireString(payload.meaning,`${base}.meaning`,errors,clientRef); optionalString(payload.origin,`${base}.origin`,errors,clientRef); if (payload.origin) validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); else if (payload.source_refs !== undefined) validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,false); return;
  }
  if (s === "joke") {
    allowedKeys(payload,["format","text","setup","punchline"],base,errors,clientRef); if (!["one_liner","setup_punchline"].includes(payload.format)) errors.push(issue("joke_format",`${base}.format`,"format muss one_liner oder setup_punchline sein.",clientRef)); if (payload.format === "one_liner") requireString(payload.text,`${base}.text`,errors,clientRef); if (payload.format === "setup_punchline") { requireString(payload.setup,`${base}.setup`,errors,clientRef); requireString(payload.punchline,`${base}.punchline`,errors,clientRef); } return;
  }
  if (s === "word") {
    allowedKeys(payload,["word","language","meaning_de","pronunciation","etymology","example","source_refs"],base,errors,clientRef); requireString(payload.word,`${base}.word`,errors,clientRef); requireString(payload.language,`${base}.language`,errors,clientRef); requireString(payload.meaning_de,`${base}.meaning_de`,errors,clientRef); optionalString(payload.pronunciation,`${base}.pronunciation`,errors,clientRef); optionalString(payload.etymology,`${base}.etymology`,errors,clientRef); if (!isObject(payload.example)) errors.push(issue("example",`${base}.example`,"example muss Objekt sein.",clientRef)); else { allowedKeys(payload.example,["text","translation_de"],`${base}.example`,errors,clientRef); optionalString(payload.example.text,`${base}.example.text`,errors,clientRef); optionalString(payload.example.translation_de,`${base}.example.translation_de`,errors,clientRef); } if (payload.etymology) validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); else if (payload.source_refs !== undefined) validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,false); return;
  }
  if (s === "idiom") {
    allowedKeys(payload,["original","translation_de","meaning","origin","usage_example","source_refs"],base,errors,clientRef); validateOriginal(payload.original,`${base}.original`,errors,clientRef); validateLanguageTranslation(payload?.original?.language,payload.translation_de,base,errors,clientRef); requireString(payload.meaning,`${base}.meaning`,errors,clientRef); optionalString(payload.origin,`${base}.origin`,errors,clientRef); if (!isObject(payload.usage_example)) errors.push(issue("usage_example",`${base}.usage_example`,"usage_example muss Objekt sein.",clientRef)); else { allowedKeys(payload.usage_example,["text","translation_de"],`${base}.usage_example`,errors,clientRef); requireString(payload.usage_example.text,`${base}.usage_example.text`,errors,clientRef); optionalString(payload.usage_example.translation_de,`${base}.usage_example.translation_de`,errors,clientRef); } validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); return;
  }
  if (s === "today-i-learned") {
    allowedKeys(payload,["title","lead","explanation","takeaway"],base,errors,clientRef); requireString(payload.title,`${base}.title`,errors,clientRef); optionalString(payload.lead,`${base}.lead`,errors,clientRef); optionalString(payload.takeaway,`${base}.takeaway`,errors,clientRef); if (!isObject(payload.explanation)) errors.push(issue("explanation",`${base}.explanation`,"explanation muss Objekt sein.",clientRef)); else { allowedKeys(payload.explanation,["text","source_refs"],`${base}.explanation`,errors,clientRef); requireString(payload.explanation.text,`${base}.explanation.text`,errors,clientRef); validateSourceRefs(payload.explanation.source_refs,`${base}.explanation.source_refs`,sourceIds,errors,clientRef,true); } return;
  }
  if (s === "media-quote") {
    allowedKeys(payload,["original","translation_de","speaker","work","context","artist","songwriters","season","episode","episode_title","source_refs"],base,errors,clientRef); validateOriginal(payload.original,`${base}.original`,errors,clientRef); validateLanguageTranslation(payload?.original?.language,payload.translation_de,base,errors,clientRef); if (!isObject(payload.speaker)) errors.push(issue("speaker",`${base}.speaker`,"speaker muss Objekt sein.",clientRef)); else { allowedKeys(payload.speaker,["name","type"],`${base}.speaker`,errors,clientRef); requireString(payload.speaker.name,`${base}.speaker.name`,errors,clientRef); requireString(payload.speaker.type,`${base}.speaker.type`,errors,clientRef); } if (!isObject(payload.work)) errors.push(issue("work",`${base}.work`,"work muss Objekt sein.",clientRef)); else { allowedKeys(payload.work,["title","medium","year"],`${base}.work`,errors,clientRef); requireString(payload.work.title,`${base}.work.title`,errors,clientRef); if (!["film","series","game","song"].includes(payload.work.medium)) errors.push(issue("medium",`${base}.work.medium`,"medium muss film, series, game oder song sein.",clientRef)); if (payload.work.year !== null && payload.work.year !== undefined && !Number.isInteger(payload.work.year)) errors.push(issue("year",`${base}.work.year`,"year muss integer oder null sein.",clientRef)); } requireString(payload.context,`${base}.context`,errors,clientRef); optionalString(payload.artist,`${base}.artist`,errors,clientRef); if (!Array.isArray(payload.songwriters)) errors.push(issue("songwriters",`${base}.songwriters`,"songwriters muss Array sein.",clientRef)); optionalString(payload.episode_title,`${base}.episode_title`,errors,clientRef); if (payload.season !== null && payload.season !== undefined && !Number.isInteger(payload.season)) errors.push(issue("season",`${base}.season`,"season muss integer oder null sein.",clientRef)); if (payload.episode !== null && payload.episode !== undefined && !Number.isInteger(payload.episode)) errors.push(issue("episode",`${base}.episode`,"episode muss integer oder null sein.",clientRef)); validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); return;
  }
  if (s === "bad-advice") { allowedKeys(payload,["advice","setup"],base,errors,clientRef); requireString(payload.advice,`${base}.advice`,errors,clientRef); optionalString(payload.setup,`${base}.setup`,errors,clientRef); return; }
  if (s === "excuse") { allowedKeys(payload,["excuse","scenario"],base,errors,clientRef); requireString(payload.excuse,`${base}.excuse`,errors,clientRef); optionalString(payload.scenario,`${base}.scenario`,errors,clientRef); return; }
  if (s === "side-quest") { allowedKeys(payload,["title","task","duration"],base,errors,clientRef); requireString(payload.title,`${base}.title`,errors,clientRef); requireString(payload.task,`${base}.task`,errors,clientRef); if (!isObject(payload.duration)) errors.push(issue("duration",`${base}.duration`,"duration muss Objekt sein.",clientRef)); else { allowedKeys(payload.duration,["min_minutes","max_minutes"],`${base}.duration`,errors,clientRef); const min=payload.duration.min_minutes,max=payload.duration.max_minutes; if (!Number.isInteger(min)||min<1) errors.push(issue("duration_min",`${base}.duration.min_minutes`,"min_minutes muss Integer >= 1 sein.",clientRef)); if (!Number.isInteger(max)||max<min) errors.push(issue("duration_max",`${base}.duration.max_minutes`,"max_minutes muss Integer >= min_minutes sein.",clientRef)); } return; }
  if (s === "cheer-me-up") { allowedKeys(payload,["kind","title","text"],base,errors,clientRef); if (!["thought","mini_task","reminder","humor"].includes(payload.kind)) errors.push(issue("cheer_kind",`${base}.kind`,"kind ist ungültig.",clientRef)); optionalString(payload.title,`${base}.title`,errors,clientRef); requireString(payload.text,`${base}.text`,errors,clientRef); return; }
  if (s === "worth-remembering") { allowedKeys(payload,["kind","text","reflection","original","translation_de","attribution","source_refs"],base,errors,clientRef); if (!["editorial","quotation"].includes(payload.kind)) errors.push(issue("worth_kind",`${base}.kind`,"kind muss editorial oder quotation sein.",clientRef)); optionalString(payload.reflection,`${base}.reflection`,errors,clientRef); if (payload.kind === "editorial") requireString(payload.text,`${base}.text`,errors,clientRef); else { validateOriginal(payload.original,`${base}.original`,errors,clientRef); validateLanguageTranslation(payload?.original?.language,payload.translation_de,base,errors,clientRef); if (!isObject(payload.attribution)) errors.push(issue("attribution",`${base}.attribution`,"attribution muss Objekt sein.",clientRef)); else { allowedKeys(payload.attribution,["name","type"],`${base}.attribution`,errors,clientRef); requireString(payload.attribution.name,`${base}.attribution.name`,errors,clientRef); requireString(payload.attribution.type,`${base}.attribution.type`,errors,clientRef); } validateSourceRefs(payload.source_refs,`${base}.source_refs`,sourceIds,errors,clientRef,true); } return; }
}

function provenanceRequired(slug, item) {
  if (["quote","fact","fun-fact","today-i-learned","media-quote","feel-good-fact","idiom"].includes(slug)) return true;
  if (slug === "wisdom" && item?.payload?.origin) return true;
  if (slug === "saying" && item?.payload?.attribution) return true;
  if (slug === "word" && item?.payload?.etymology) return true;
  if (slug === "worth-remembering" && item?.payload?.kind === "quotation") return true;
  return false;
}

export function validateImportDocument(document) {
  const errors = [], warnings = [];
  if (!isObject(document)) return { errors: [issue("document", "", "Import muss ein JSON-Objekt sein.")], warnings, category: null, items: [] };
  allowedKeys(document, TOP_KEYS, "", errors);
  if (document.format !== "daily-content-import") errors.push(issue("format", "format", "format muss daily-content-import sein."));
  if (document.format_version !== 1) errors.push(issue("format_version", "format_version", "format_version muss 1 sein."));
  const category = getDailyCategory(document.category);
  if (!category) errors.push(issue("category", "category", "Unbekannte Kategorie."));
  if (document.payload_schema_version !== 1) errors.push(issue("payload_schema_version", "payload_schema_version", "payload_schema_version muss 1 sein."));
  if (!isObject(document.defaults)) errors.push(issue("defaults", "defaults", "defaults muss Objekt sein."));
  else {
    allowedKeys(document.defaults,["status","initial_times_shown"],"defaults",errors);
    if (!STATUS_VALUES.has(document.defaults.status)) errors.push(issue("status","defaults.status","status muss active oder archived sein."));
    validateTimesShown(document.defaults.initial_times_shown,"defaults.initial_times_shown",errors);
  }
  if (!Array.isArray(document.items)) errors.push(issue("items","items","items muss Array sein."));
  else if (document.items.length === 0) errors.push(issue("items","items","Import benötigt mindestens einen Eintrag."));
  else if (document.items.length > MAX_ITEMS) errors.push(issue("items_limit","items",`Maximal ${MAX_ITEMS} Einträge pro Import. `));

  const validatedItems=[];
  if (category && Array.isArray(document.items)) {
    document.items.forEach((item,index)=>{
      const base=`items[${index}]`, clientRef=isNonEmptyString(item?.client_ref)?item.client_ref:null;
      if (!isObject(item)) { errors.push(issue("item",base,"Eintrag muss Objekt sein.",clientRef)); return; }
      allowedKeys(item,ITEM_KEYS,base,errors,clientRef);
      if (item.client_ref !== undefined) requireString(item.client_ref,`${base}.client_ref`,errors,clientRef);
      if (item.status !== undefined && !STATUS_VALUES.has(item.status)) errors.push(issue("status",`${base}.status`,"status muss active oder archived sein.",clientRef));
      if (item.initial_times_shown !== undefined) validateTimesShown(item.initial_times_shown,`${base}.initial_times_shown`,errors,clientRef);
      const required=provenanceRequired(category.slug,item);
      const sourceIds=validateProvenance(item.provenance,`${base}.provenance`,errors,warnings,clientRef,required);
      validatePayload(category,item.payload,`${base}.payload`,errors,warnings,sourceIds,clientRef);
      const serialized=JSON.stringify(item.payload || {});
      if (serialized.length > 12000) warnings.push(issue("large_payload",`${base}.payload`,`Payload ist ungewöhnlich groß (${serialized.length} Zeichen).`,clientRef));
      validatedItems.push({ index, clientRef, item });
    });
  }
  return { errors, warnings, category, items: validatedItems };
}

export function canonicalDedupeText(slug, payload) {
  if (slug === "quote") return `${payload?.original?.text || ""}|${payload?.attribution?.name || ""}|${payload?.work?.title || ""}`;
  if (["saying","wisdom"].includes(slug)) return payload?.text || "";
  if (slug === "joke") return payload?.format === "setup_punchline" ? `${payload?.setup || ""}|${payload?.punchline || ""}` : payload?.text || "";
  if (["fact","fun-fact","feel-good-fact"].includes(slug)) return payload?.fact?.text || "";
  if (slug === "word") return `${payload?.language || ""}|${payload?.word || ""}`;
  if (slug === "idiom") return `${payload?.original?.language || ""}|${payload?.original?.text || ""}`;
  if (slug === "today-i-learned") return `${payload?.title || ""}|${payload?.explanation?.text || ""}`;
  if (slug === "media-quote") return `${payload?.original?.text || ""}|${payload?.speaker?.name || ""}|${payload?.work?.title || ""}`;
  if (slug === "bad-advice") return payload?.advice || "";
  if (slug === "excuse") return payload?.excuse || "";
  if (slug === "side-quest") return `${payload?.title || ""}|${payload?.task || ""}`;
  if (slug === "cheer-me-up") return `${payload?.kind || ""}|${payload?.text || ""}`;
  if (slug === "worth-remembering") return payload?.kind === "quotation" ? payload?.original?.text || "" : payload?.text || "";
  return JSON.stringify(payload || {});
}

export function normalizeDedupeText(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("de-DE").replace(/\s+/g," ");
}

export function displayLabelFor(slug, payload) {
  let text="";
  if (slug === "quote") text = payload?.original?.text;
  else if (["saying","wisdom"].includes(slug)) text = payload?.text;
  else if (slug === "joke") text = payload?.format === "setup_punchline" ? payload?.setup : payload?.text;
  else if (["fact","fun-fact","feel-good-fact"].includes(slug)) text = payload?.fact?.text;
  else if (slug === "word") text = payload?.word;
  else if (slug === "idiom") text = payload?.original?.text;
  else if (slug === "today-i-learned") text = payload?.title;
  else if (slug === "media-quote") text = `${payload?.work?.title || "Media"}: ${payload?.speaker?.name || "Quote"}`;
  else if (slug === "bad-advice") text = payload?.advice;
  else if (slug === "excuse") text = payload?.excuse;
  else if (slug === "side-quest") text = payload?.title;
  else if (slug === "cheer-me-up") text = payload?.title || payload?.text;
  else if (slug === "worth-remembering") text = payload?.kind === "quotation" ? payload?.original?.text : payload?.text;
  text=String(text || slug).replace(/\s+/g," ").trim();
  return text.length > 80 ? `${text.slice(0,77).trimEnd()}…` : text;
}
