# Daily Content – Kategorie-Handoff: Media Quote des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Media Quote des Tages**
- Slug: `media-quote`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Media_Quote.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Kurze, belegte Zeilen aus **Film, Serie, Videospiel oder Song**.
- Die vier Medienarten sollen über den Pool sinnvoll gemischt werden; kein Medium sollte den Pool dominieren.
- Nur sehr kurze Ausschnitte verwenden. Bei Songs besonders streng: keine langen Lyrics oder mehrere Zeilen reproduzieren.
- Werk, Sprecher/Performer und Kontext sorgfältig verifizieren.
- `work.medium` ausschließlich `film`, `series`, `game` oder `song`.
- Für Nicht-Songs muss `songwriters` trotzdem als leeres Array `[]` vorhanden sein, weil der aktuelle Validator dieses Feld immer als Array erwartet.
- `artist`, `season`, `episode`, `episode_title` dürfen je nach Medium `null` sein.

## Exaktes Payload-Schema

```json
{
  "original": {"text": "...", "language": "en"},
  "translation_de": "...",
  "speaker": {"name": "...", "type": "fictional_character"},
  "work": {"title": "...", "medium": "film", "year": 1999},
  "context": "...",
  "artist": null,
  "songwriters": [],
  "season": null,
  "episode": null,
  "episode_title": null,
  "source_refs": ["src_1"]
}
```

Bei Songs `artist` sinnvoll setzen und Songwriter nur eintragen, wenn zuverlässig belegt. Bei Serien können Staffel/Episode ergänzt werden. Bei deutschem Original `translation_de: null`.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `media-quote`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Media_Quote.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
