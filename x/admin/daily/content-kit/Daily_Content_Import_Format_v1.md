# Daily Content Import Format v1

This document defines the canonical UTF-8 JSON import format for Daily Content.

## Core rules

- One import file contains exactly one category.
- `format` is always `daily-content-import`.
- `format_version` is currently `1`.
- `payload_schema_version` is currently `1`.
- New valid items default to `status = active`.
- Invalid items are not imported; they are never silently stored as `archived`.
- Database IDs, `dedupe_key`, timestamps, `display_label`, and import IDs are system-generated and must not be supplied by the import file.
- JSON is the transport format only. D1 becomes the source of truth after commit.

## Canonical envelope

```json
{
  "format": "daily-content-import",
  "format_version": 1,
  "category": "fact",
  "payload_schema_version": 1,
  "defaults": {
    "status": "active",
    "initial_times_shown": {
      "mode": "match_current_pool"
    }
  },
  "items": []
}
```

### `initial_times_shown`

Default:

```json
{"mode":"match_current_pool"}
```

The importer resolves this once at commit time to the current minimum `times_shown` among active entries in that category. An empty active pool resolves to `0`.

Manual override:

```json
{"mode":"manual","value":3}
```

An individual item may optionally override the file default with its own `initial_times_shown` object.

## Item structure

Every item has:

```json
{
  "client_ref": "optional-human-readable-import-reference",
  "payload": {},
  "provenance": null
}
```

Optional per-item fields:

- `status`: `active` or `archived`; omitted means file default (`active`).
- `initial_times_shown`: per-item override.

`client_ref` exists only to make validation and import errors easy to identify. It is not a database ID.

## Sources and `source_refs`

Sources are local to one item and live in `provenance.sources`.

```json
{
  "provenance": {
    "sources": [
      {
        "id": "src_1",
        "type": "web",
        "title": "Source title",
        "publisher": "Publisher",
        "url": "https://example.org/source",
        "author": null,
        "year": 2026,
        "locator": null
      }
    ],
    "verification": {
      "verified": true,
      "note": "Internal verification note"
    }
  }
}
```

Rules:

- Source IDs only need to be unique within that item.
- Every referenced `source_ref` must exist in that same item's `provenance.sources`.
- A top-level payload `source_refs` may support the whole entry.
- Categories such as `fact` use more granular refs on `fact` and `explanation`.
- Internal verification notes are not automatically exposed to the browser.

## Category schemas

### `quote`
Required: `original.text`, `original.language`, German translation when non-German, `attribution.name`, `attribution.type`, `meaning`, `about_attribution`, and verified source refs. Optional: work, year, context.

### `saying`
Required: `text`, `language`. Translation required when non-German. `meaning`, `tone`, and attribution are optional. If an attribution or specific origin is claimed, source refs become required.

### `wisdom`
Required: `text`, `language`, `meaning`. Translation required when non-German. `origin` optional; if origin is claimed, it must be sourced.

### `joke`
`format` is `one_liner` or `setup_punchline`. `one_liner` requires `text`; `setup_punchline` requires `setup` and `punchline`. No source required by default.

### `fact`
Requires `fact.text`, `fact.source_refs[]`, `explanation.text`, and `explanation.source_refs[]`.

### `word`
Requires `word`, `language`, `meaning_de`. Pronunciation, etymology, example text/translation optional. Claims about etymology should be sourced.

### `idiom`
Requires original text/language, German rendering, figurative meaning, and a usage example. Origin is optional but must be sourced when claimed.

### `fun-fact`
Same source-bearing fact structure as `fact`; content tone is lighter/curious.

### `today-i-learned`
Requires `title`, `explanation.text`, and `explanation.source_refs[]`. `lead` and `takeaway` optional.

### `media-quote`
Requires verified short original line, language, German translation when non-German, speaker, work title, `work.medium` (`film`, `series`, `game`, `song`), context, and source refs. Year may be unknown. Songs may additionally use `artist` and `songwriters`; series may use season/episode metadata. No audio.

### `bad-advice`
Requires `advice`; optional `setup`. This is comedy, not real advice.

### `excuse`
Requires `excuse`; optional `scenario`.

### `side-quest`
Requires `title`, `task`, `duration.min_minutes`, `duration.max_minutes`. Duration is integer minutes, `min_minutes >= 1`, `max_minutes >= min_minutes`. Tasks must be safe, realistic, and low effort.

### `cheer-me-up`
Requires `kind` (`thought`, `mini_task`, `reminder`, `humor`) and `text`; optional `title`.

### `feel-good-fact`
Same source-bearing fact structure as `fact`. Must be genuinely positive/hopeful without misleading framing.

### `worth-remembering`
`kind` is `editorial` or `quotation`. Editorial requires `text`; quotation uses the quote-style original/translation/attribution/source rules. `reflection` optional.

## Validation levels

### Blocking errors

- invalid JSON
- wrong format/version
- unknown category
- wrong payload schema version
- missing required field
- wrong field type
- unknown enum value
- invalid source reference
- required source missing
- negative/manual `times_shown`
- exact duplicate according to the category's normalized dedupe key

### Non-blocking warnings

- year unknown
- unusually long content
- suspiciously incomplete optional metadata
- possible semantic duplicate, when semantic checking is enabled

Semantic near-duplicate checking is optional and must not be required for the normal Cloudflare Free-path. The database unique constraint remains the authoritative exact-duplicate guard.

## Strictness

Version 1 should be schema-strict: unknown structural fields are rejected rather than silently ignored. Future fields require a schema/version update. This catches misspellings in LLM or hand-written imports early.

## Examples

The companion archive `Daily_Content_Import_Examples_v1.zip` contains one structurally representative JSON file for each of the 16 categories. Values beginning with `REPLACE_` and `example.invalid` are documentation placeholders and are not production content.
