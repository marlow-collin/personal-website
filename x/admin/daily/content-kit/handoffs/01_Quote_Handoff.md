# Daily Content – Kategorie-Handoff: Zitat des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Zitat des Tages**
- Slug: `quote`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Quote.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Nur echte, belegbare Zitate.
- Gute Mischung aus historischen und modernen Stimmen sowie – in moderatem Umfang – fiktiven Figuren.
- Nicht nur extrem bekannte Standardzitate; trotzdem nur verlässlich belegbare Aussagen verwenden.
- `attribution.type` ausschließlich `real_person` oder `fictional_character`.
- Bei fiktiven Figuren Werk sauber separat angeben.
- `meaning` erklärt knapp, warum das Zitat interessant/merkenswert ist.
- `about_attribution` gibt eine kurze sachliche Einordnung der Person/Figur.
- `context` nur setzen, wenn er zuverlässig bekannt ist, sonst `null`.
- Sehr kurze Zitatpassagen verwenden; keine langen urheberrechtlich geschützten Textstellen.

## Exaktes Payload-Schema

```json
{
  "original": {"text": "...", "language": "en"},
  "translation_de": "...",
  "attribution": {"name": "...", "type": "real_person"},
  "work": {"title": "...", "type": "speech", "year": 1963},
  "meaning": "...",
  "context": "...",
  "about_attribution": "...",
  "source_refs": ["src_1"]
}
```

`work` darf `null` sein. Wenn vorhanden, sind dort nur `title`, `type`, `year` erlaubt. `year` ganzzahlig oder `null`.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `quote`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Quote.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
