# Daily Content – Kategorie-Handoff: Wort des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Wort des Tages**
- Slug: `word`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Word.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

`provenance` darf `null` sein, sofern keine konkrete Herkunft/Zuschreibung/Etymologie behauptet wird. Sobald eine solche Behauptung gemacht wird, müssen die dazugehörigen Quellen gemäß Basis-Handoff vollständig angegeben werden.

## Inhaltliche Anforderungen

- Interessante, tatsächlich verwendete Wörter mit präziser deutscher Bedeutung.
- Gute Mischung aus deutschen und internationalen Wörtern; exotische Wörter nur verwenden, wenn Bedeutung und Gebrauch zuverlässig verifizierbar sind.
- `meaning_de` immer klar und alltagstauglich erklären.
- `pronunciation` nur als Text/Phonetik, niemals Audio.
- `example` ist als Objekt Pflicht. Verwende nach Möglichkeit ein natürliches Beispiel.
- Etymologie nur nennen, wenn zuverlässig belegt. Sobald `etymology` nicht leer ist, sind `source_refs` und `provenance` Pflicht.
- Für Qualitätszwecke sollen auch Bedeutungen nicht frei erfunden werden; bei seltenen Wörtern recherchieren.

## Exaktes Payload-Schema

```json
{
  "word": "...",
  "language": "de",
  "meaning_de": "...",
  "pronunciation": "...",
  "etymology": "...",
  "example": {
    "text": "...",
    "translation_de": null
  },
  "source_refs": ["src_1"]
}
```

`pronunciation` und `etymology` dürfen `null` sein. `source_refs` kann entfallen, wenn keine Etymologie angegeben wird. Bei einem nichtdeutschen Beispiel eine deutsche Übersetzung angeben.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `word`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Word.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
