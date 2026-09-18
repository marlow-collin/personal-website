# Daily Content – Kategorie-Handoff: Redewendung des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Redewendung des Tages**
- Slug: `idiom`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Idiom.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Nur echte feste Redewendungen/Idiome, keine bloßen Sprüche.
- Bedeutung klar vom wörtlichen Wortlaut trennen.
- Natürlichen Verwendungssatz liefern.
- `origin` darf `null` sein; wenn eine Herkunft genannt wird, muss sie besonders zuverlässig belegt sein.
- Da die Kategorie insgesamt quellenpflichtig ist, auch ohne Ursprung mindestens die Existenz/Bedeutung anhand einer zuverlässigen Sprachquelle belegen.

## Exaktes Payload-Schema

```json
{
  "original": {"text": "...", "language": "en"},
  "translation_de": "...",
  "meaning": "...",
  "origin": null,
  "usage_example": {
    "text": "...",
    "translation_de": "..."
  },
  "source_refs": ["src_1"]
}
```

Bei deutschem Original ist `translation_de: null`. `usage_example.translation_de` darf `null` sein.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `idiom`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Idiom.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
