# Daily Content – Kategorie-Handoff: Fun Fact des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Fun Fact des Tages**
- Slug: `fun-fact`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Fun_Fact.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Wahr, überraschend, charmant oder kurios – aber nicht bloß ein normaler Fact mit Ausrufezeichen.
- Bevorzuge Inhalte mit einem echten „Das wusste ich nicht“-Moment.
- Keine Mythen, Clickbait-Superlative oder unbelegte Tier-/Geschichtsbehauptungen.
- Themen abwechslungsreich halten und nicht zu stark auf Tiere beschränken.
- `fact` und `explanation` müssen beide durch `source_refs` abgesichert sein.

## Exaktes Payload-Schema

```json
{
  "fact": {
    "text": "...",
    "source_refs": ["src_1"]
  },
  "explanation": {
    "text": "...",
    "source_refs": ["src_1", "src_2"]
  }
}
```

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `fun-fact`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Fun_Fact.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
