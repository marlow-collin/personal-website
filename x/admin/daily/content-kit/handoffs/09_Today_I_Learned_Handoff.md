# Daily Content – Kategorie-Handoff: Heute gelernt

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Heute gelernt**
- Slug: `today-i-learned`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Today_I_Learned.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Diese Kategorie ist **quellenpflichtig**. Jedes Item benötigt ein `provenance`-Objekt mit mindestens einer tragfähigen Quelle und:

```json
"verification": {"verified": true, "note": "..."}
```

Die im Payload verwendeten `source_refs` müssen auf Quellen dieses Items verweisen.

## Inhaltliche Anforderungen

- Diese Kategorie ist ein kleiner Mini-Explainer, nicht nur ein einzelner Fact.
- Ideal sind Fragen/Mechanismen wie „Warum passiert X?“, „Wie funktioniert Y?“ oder „Wieso ist Z so?“.
- `title` neugierig machend, aber nicht clickbaitig.
- `explanation` liefert den eigentlichen Lernwert und muss quellenbelegt sein.
- `lead` kann einen kurzen Einstieg bilden; `takeaway` kann den Kern in einem Satz abrunden.
- Inhaltlich nicht einfach bestehende Facts/Fun Facts in länger wiederholen.

## Exaktes Payload-Schema

```json
{
  "title": "...",
  "lead": "...",
  "explanation": {
    "text": "...",
    "source_refs": ["src_1", "src_2"]
  },
  "takeaway": "..."
}
```

`lead` und `takeaway` dürfen `null` sein.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `today-i-learned`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Today_I_Learned.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
