# Daily Content – Kategorie-Handoff: Cheer Me Up

## Verwendung

Gib einem neuen Chat diese Datei zusammen mit:

1. `Daily_Content_Generation_Base.md`
2. `reference/Daily_Content_Import_Template.json`

Optional kann zusätzlich `reference/Daily_Content_Import_Format_v1.md` mitgegeben werden. **Diese Kategorie-Handoff hat Vorrang bei kategoriespezifischen Details.**

Arbeite den Auftrag ohne weitere Konzeptdiskussion ab und liefere am Ende eine direkt über `/x/admin2/` importierbare JSON-Datei.

## Auftrag

- Kategorie: **Cheer Me Up**
- Slug: `cheer-me-up`
- `payload_schema_version`: `1`
- Standardmenge: **50 neue Einträge**, sofern der Benutzer nichts anderes angibt
- Dateiname empfohlen: `Daily_Content_Cheer_Me_Up.json`

## Aktueller Bestand

Der aktuelle produktive Pool dieser Kategorie ist zum Zeitpunkt dieser Handoff **leer**. Es gibt keine bestehenden Einträge, die berücksichtigt werden müssen.

## Quellenstatus

Für diese Kategorie ist normalerweise **keine Recherchequelle erforderlich**; `provenance` soll `null` sein. Erfinde trotzdem keine reale Zuschreibung oder Tatsachenbehauptung. Wenn ein Eintrag ausnahmsweise eine überprüfbare reale Behauptung enthält, formuliere ihn besser so um, dass die Kategorie ohne Faktenbehauptung funktioniert.

## Inhaltliche Anforderungen

- Originäre Inhalte dürfen erstellt werden.
- Leicht, warm, freundlich und spielerisch; nicht kitschig oder therapeutisch übergriffig.
- Keine Diagnosen, Mental-Health-Versprechen oder „positivity fixes“ für ernste Probleme.
- Sinnvolle Mischung der vier `kind`-Werte: `thought`, `mini_task`, `reminder`, `humor`.
- Mini-Aufgaben müssen sicher und sehr niedrigschwellig sein.

## Exaktes Payload-Schema

```json
{
  "kind": "thought",
  "title": "...",
  "text": "..."
}
```

`title` darf `null` sein. `kind` ausschließlich `thought`, `mini_task`, `reminder`, `humor`.

## Finale Kategorieprüfung

Vor Ausgabe zusätzlich sicherstellen:

- Top-Level `category` ist exakt `cheer-me-up`.
- `payload_schema_version` ist `1`.
- Datei enthält nur diese Kategorie.
- Alle Items haben eindeutige `client_ref`-Werte.
- Keine zusätzlichen Payload-Felder außerhalb des oben dokumentierten Schemas.
- Standard `active` + `match_current_pool` bleibt unverändert.

Erstelle anschließend die downloadbare Datei **`Daily_Content_Cheer_Me_Up.json`** (oder einen Dateinamen mit derselben eindeutigen Kategoriebezeichnung).
