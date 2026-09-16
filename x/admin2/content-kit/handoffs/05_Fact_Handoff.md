# Daily Content – Kategorie-Handoff: Fakt des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Fakt des Tages**
- Slug: `fact`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Fact.json`

## Aktueller Bestand

Der aktuelle Bestand wird **nicht statisch in dieser Handoff gepflegt**. Verwende die zusätzlich hochgeladene Datei `Daily_Content_Existing_Fact.json` als maßgebliche Referenz für alle bereits vorhandenen aktiven und archivierten Fact-Einträge.

Prüfe neue Vorschläge gegen diesen Export und vermeide sowohl exakte Duplikate als auch bloße Umformulierungen oder semantisch sehr ähnliche Varianten.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Jeder Eintrag enthält eine kompakte, überprüfbare Kernaussage und eine verständliche kurze Erklärung.
- Themen breit streuen: Natur, Technik, Sprache, Geschichte, Geografie, Astronomie, Alltagswissenschaft, Kultur, Mathematik usw.
- Keine medizinischen oder gesundheitsbezogenen Behauptungen, wenn sie für ein lockeres Daily-Format unnötig riskant oder kontextabhängig sind.
- Keine Urban Legends, Superlative ohne klare Definition oder „Fun Facts“, deren Wahrheitsgehalt nur aus Wiederholungen im Netz besteht.
- `fact.source_refs` müssen die Kernaussage stützen; `explanation.source_refs` die Erklärung.
- Bevorzugt mindestens eine starke Primär-/Institutionenquelle; bei ungewöhnlichen Behauptungen möglichst gegen eine zweite hochwertige Quelle prüfen.

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

- Top-Level `category` ist exakt `fact`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Fact.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
