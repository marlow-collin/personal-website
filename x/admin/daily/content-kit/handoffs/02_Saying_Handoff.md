# Daily Content – Kategorie-Handoff: Spruch des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Spruch des Tages**
- Slug: `saying`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Saying.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

`provenance` darf `null` sein, sofern keine konkrete Herkunft/Zuschreibung/Etymologie behauptet wird. Sobald eine solche Behauptung gemacht wird, müssen die dazugehörigen Quellen gemäß Basis-Handoff vollständig angegeben werden.

## Inhaltliche Anforderungen

- Ein „Spruch“ ist eine kurze eigenständige Aussage, nicht zwingend ein berühmtes Zitat und nicht dasselbe wie eine Redewendung.
- Bevorzuge etablierte Sprüche, Lebenssätze oder prägnante Formulierungen mit klarer Aussage.
- Keine falschen berühmten Zuschreibungen. Wenn die Urheberschaft unsicher ist, `attribution` weglassen.
- Wenn `attribution` vorhanden ist, sind Quellen Pflicht.
- `meaning` und `tone` sind optional, aber bei mindestens einem Großteil der Einträge sinnvoll.

## Exaktes Payload-Schema

```json
{
  "text": "...",
  "language": "de",
  "translation_de": null,
  "meaning": "...",
  "tone": "ermutigend",
  "attribution": null
}
```

Mit Zuschreibung zusätzlich:

```json
"attribution": {"name": "...", "type": "real_person"},
"source_refs": ["src_1"]
```

Bei nichtdeutschem Text ist `translation_de` Pflicht.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `saying`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Saying.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
