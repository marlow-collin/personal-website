# Daily Content – Kategorie-Handoff: Worth Remembering

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Worth Remembering**
- Slug: `worth-remembering`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Worth_Remembering.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

`provenance` darf `null` sein, sofern keine konkrete Herkunft/Zuschreibung/Etymologie behauptet wird. Sobald eine solche Behauptung gemacht wird, müssen die dazugehörigen Quellen gemäß Basis-Handoff vollständig angegeben werden.

## Inhaltliche Anforderungen

- Ruhig, ernsthaft, klar und merkenswert.
- **Originäre redaktionelle Gedanken sind ausdrücklich erlaubt** und sollen den Großteil des Pools bilden.
- Zielverteilung ungefähr 75 % `editorial`, 25 % `quotation`.
- Editorial-Texte dürfen keine fremden Zitate imitieren oder erfundene Autoritäten suggerieren.
- Bei `quotation` gelten dieselben strengen Recherche- und Quellenregeln wie bei echten Zitaten; `provenance` ist dann Pflicht.
- `reflection` ist optional und darf den Gedanken kurz vertiefen.

## Exakte Payload-Varianten

Editorial:

```json
{
  "kind": "editorial",
  "text": "...",
  "reflection": "..."
}
```

Quotation:

```json
{
  "kind": "quotation",
  "original": {"text": "...", "language": "en"},
  "translation_de": "...",
  "attribution": {"name": "...", "type": "real_person"},
  "source_refs": ["src_1"],
  "reflection": "..."
}
```

Bei deutschem Original `translation_de: null`.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `worth-remembering`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Worth_Remembering.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
