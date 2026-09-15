# Daily Content – Kategorie-Handoff: Weisheit des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Weisheit des Tages**
- Slug: `wisdom`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Wisdom.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

`provenance` darf `null` sein, sofern keine konkrete Herkunft/Zuschreibung/Etymologie behauptet wird. Sobald eine solche Behauptung gemacht wird, müssen die dazugehörigen Quellen gemäß Basis-Handoff vollständig angegeben werden.

## Inhaltliche Anforderungen

- Der Schwerpunkt liegt auf zeitlosen Erkenntnissen, Lebensregeln oder reflektierten Einsichten.
- Nicht einfach Zitate aus der Quote-Kategorie kopieren.
- `meaning` ist immer Pflicht und soll den Gedanken knapp erläutern, nicht banal wiederholen.
- `origin` nur nennen, wenn die Herkunft ausreichend sicher ist; sobald `origin` gesetzt wird, sind Quellen Pflicht.
- Vorsicht bei angeblich „chinesischen“, „afrikanischen“, „buddhistischen“ usw. Weisheiten ohne belastbaren Beleg: lieber keine Herkunft behaupten.

## Exaktes Payload-Schema

```json
{
  "text": "...",
  "language": "de",
  "translation_de": null,
  "meaning": "...",
  "origin": null
}
```

Mit belegter Herkunft zusätzlich `source_refs` und `provenance`.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `wisdom`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Wisdom.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
