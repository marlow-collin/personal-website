# Daily Content – Kategorie-Handoff: Schlechter Rat des Tages

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Schlechter Rat des Tages**
- Slug: `bad-advice`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Bad_Advice.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Für diese Kategorie ist normalerweise **keine Recherchequelle erforderlich**; `provenance` soll `null` sein. Erfinde trotzdem keine reale Zuschreibung oder Tatsachenbehauptung. Wenn ein Eintrag ausnahmsweise eine überprüfbare reale Behauptung enthält, formuliere ihn besser so um, dass die Kategorie ohne Faktenbehauptung funktioniert.

## Inhaltliche Anforderungen

- Originäre Inhalte dürfen erstellt werden.
- Der Rat muss erkennbar absurd/schlecht und humorvoll sein, nicht als echte Empfehlung funktionieren.
- Keine gefährlichen Anweisungen, illegalen Handlungen, Selbstschädigung oder ernsthaft riskanten Finanz-/Gesundheits-/Sicherheitsratschläge.
- Alltagsabsurdität funktioniert besser als maximale Eskalation.
- Gute stilistische Vielfalt; nicht 50 Varianten desselben „prokrastiniere einfach“-Witzes.

## Exaktes Payload-Schema

```json
{
  "advice": "...",
  "setup": "..."
}
```

`setup` darf `null` sein.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `bad-advice`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Bad_Advice.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
