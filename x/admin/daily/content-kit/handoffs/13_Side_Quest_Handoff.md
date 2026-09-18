# Daily Content – Kategorie-Handoff: Side Quest des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Side Quest des Tages**
- Slug: `side-quest`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Side_Quest.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Für diese Kategorie ist normalerweise **keine Recherchequelle erforderlich**; `provenance` soll `null` sein. Erfinde trotzdem keine reale Zuschreibung oder Tatsachenbehauptung. Wenn ein Eintrag ausnahmsweise eine überprüfbare reale Behauptung enthält, formuliere ihn besser so um, dass die Kategorie ohne Faktenbehauptung funktioniert.

## Inhaltliche Anforderungen

- Originäre kleine Aufgaben dürfen erstellt werden.
- Sicher, legal, realistisch, niedrigschwellig und ohne spezielle Ausrüstung machbar.
- Keine Aufgaben, die Autofahren, riskante Orte, fremdes Eigentum, Belästigung, Geldausgaben oder körperliche Überforderung voraussetzen.
- Gute Mischung aus drinnen/draußen, kreativ, aufmerksam, sozial, Bewegung, Mini-Entdeckung.
- Zeitangabe immer realistisch in ganzen Minuten.

## Exaktes Payload-Schema

```json
{
  "title": "...",
  "task": "...",
  "duration": {
    "min_minutes": 5,
    "max_minutes": 10
  }
}
```

`min_minutes >= 1`, `max_minutes >= min_minutes`. Für exakt 5 Minuten beide Werte auf `5` setzen.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `side-quest`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Side_Quest.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
