# Daily Content – Kategorie-Handoff: Feel-Good Fact des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Feel-Good Fact des Tages**
- Slug: `feel-good-fact`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Feel_Good_Fact.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Echte positive, hoffnungsvolle oder herzerwärmende Fakten.
- Positive Wirkung muss sich aus dem Fakt selbst ergeben, nicht aus irreführender Schönfärberei.
- Gute Mischung aus Natur, Gesellschaft, Wissenschaft, Kultur, Erholung von Arten/Ökosystemen, hilfreichen Entwicklungen usw.
- Vorsicht mit schnell veraltenden Erfolgszahlen: Veröffentlichungsjahr und Kontext beachten.
- Keine vagen „Die Welt wird immer besser“-Behauptungen ohne belastbare Daten.
- `fact` und `explanation` müssen beide quellenbelegt sein.

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

- Top-Level `category` ist exakt `feel-good-fact`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Feel_Good_Fact.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
