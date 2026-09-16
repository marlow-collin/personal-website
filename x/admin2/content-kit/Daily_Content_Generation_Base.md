# Daily Content – Gemeinsame Content-Generation-Basis

## Auftrag

Du arbeitest ausschließlich an **einer** Daily-Content-Kategorie. Lies zusätzlich die zugehörige Kategorie-Handoff-Datei und den mitgelieferten Bestands-Export `Daily_Content_Existing_*.json` vollständig. Die Handoff definiert Kategorie, Payload-Schema, Quellenregeln und besondere Qualitätsanforderungen; der Bestands-Export ist die maßgebliche Quelle für aktuell bereits vorhandene Inhalte.

Das Ziel ist **eine direkt über `/x/admin2/` validier- und importierbare UTF-8-JSON-Datei**. Kein SQL, keine Datenbank-IDs und kein zusätzlicher Fließtext in der finalen Datei.

## Standardmenge

Wenn der Benutzer keine andere Anzahl nennt, erstelle **50 neue Einträge**. Qualität hat Vorrang vor Anzahl. Wenn du nicht genügend seriöse, voneinander verschiedene Einträge findest, liefere weniger und erkläre dem Benutzer vor Erstellung der finalen Datei kurz warum. Erfinde niemals schwächere Inhalte, um eine Zielzahl zu erreichen.

Der Importer akzeptiert maximal 250 Einträge pro Datei.

## Kanonischer Envelope

Die finale Datei muss exakt dieses Top-Level-Schema verwenden:

```json
{
  "format": "daily-content-import",
  "format_version": 1,
  "category": "<SLUG>",
  "payload_schema_version": 1,
  "defaults": {
    "status": "active",
    "initial_times_shown": {
      "mode": "match_current_pool"
    }
  },
  "items": []
}
```

Keine zusätzlichen Top-Level-Felder.

## Struktur eines Items

Erlaubt sind ausschließlich:

- `client_ref`
- `payload`
- `provenance`
- optional `status`
- optional `initial_times_shown`

Normalfall:

```json
{
  "client_ref": "<eindeutige-lesbare-referenz>",
  "payload": {},
  "provenance": null
}
```

Erzeuge **keine** Systemfelder wie `id`, `dedupe_key`, `display_label`, `import_batch_id`, `created_at`, `updated_at` oder `times_shown`.

## Strikte Importer-Regeln

Der produktive `/x/admin2/`-Validator ist schema-strikt. Unbekannte Felder werden abgelehnt. Verwende deshalb nur die Felder aus der Kategorie-Handoff.

`status` darf nur `active` oder `archived` sein. Neue Inhalte bleiben normalerweise `active`.

`initial_times_shown` bleibt normalerweise auf Datei-Ebene bei:

```json
{"mode":"match_current_pool"}
```

Kein manuelles Level setzen, wenn es nicht ausdrücklich verlangt wird.

## Recherche und Faktentreue

Für alle quellenpflichtigen Inhalte musst du recherchieren. Nutze aktuelle Web-Recherche, wenn sie für zuverlässige Verifikation erforderlich ist.

Bevorzuge in dieser Reihenfolge:

1. Primärquellen / offizielle Institutionen / Originalarchive
2. wissenschaftliche Publikationen oder anerkannte Fachdatenbanken
3. hochwertige, redaktionell verantwortete Sekundärquellen

Keine erfundenen Fakten, Zitate, Zuschreibungen, Ursprünge, Etymologien, Jahreszahlen, Werkangaben oder Quellen.

Wenn eine Behauptung nicht zuverlässig belegbar ist, verwende sie nicht.

## Quellenformat

Erlaubte `source.type`-Werte:

- `web`
- `book`
- `media`
- `journal`
- `paper`
- `database`
- `archive`
- `other`

Eine Web-Quelle benötigt eine `https://`-URL.

Schema:

```json
{
  "provenance": {
    "sources": [
      {
        "id": "src_1",
        "type": "web",
        "title": "Titel",
        "publisher": "Herausgeber oder null",
        "url": "https://...",
        "author": "Autor oder null",
        "year": 2026,
        "locator": "Abschnitt/Seite/Episode oder null"
      }
    ],
    "verification": {
      "verified": true,
      "note": "Kurzer interner Hinweis zur Prüfung"
    }
  }
}
```

`year` muss ganzzahlig oder `null` sein. `publisher`, `url`, `author`, `locator` dürfen Strings oder `null` sein.

Quellen-IDs wie `src_1` gelten nur innerhalb des jeweiligen Items. Jeder verwendete `source_ref` muss auf eine dort vorhandene Source-ID zeigen.

Bei quellenpflichtigem Content ist `verification.verified` immer `true`.

## Sprachen und Übersetzungen

Sprachcodes kurz und konsistent angeben, z. B. `de`, `en`, `fr`, `es`, `it`, `ja`.

Wenn ein Original deutsch ist:

```json
"translation_de": null
```

Wenn ein Original nicht deutsch ist, ist eine saubere deutsche Übersetzung Pflicht.

Original und Übersetzung niemals vermischen. Übersetzungen als Übersetzung behandeln, nicht als angeblichen Originalwortlaut.

## Duplikate

Prüfe gegen den mitgelieferten `Daily_Content_Existing_*.json`-Export. Er enthält aktive und archivierte Einträge der Kategorie. Erstelle keine exakten Duplikate, keine bloßen Umformulierungen und keine semantisch sehr ähnlichen Varianten bereits vorhandener Inhalte.

Der Bestands-Export ist nur eine Referenz zur Duplikatvermeidung und darf nicht als Importdatei zurückgegeben werden. Der Importer erkennt exakte normalisierte Duplikate zusätzlich automatisch. Die semantische Prüfung ist deine Aufgabe.

`client_ref` soll pro Datei eindeutig und stabil lesbar sein, z. B.:

```text
fact-octopus-hearts-001
quote-maya-angelou-001
side-quest-window-walk-001
```

## Urheberrecht und Zitate

Bei Zitaten aus urheberrechtlich geschützten Werken nur **kurze, notwendige Ausschnitte** verwenden. Besonders bei Songs sehr zurückhaltend sein. Keine langen Songtexte, Dialogpassagen, Gedichte oder Buchpassagen reproduzieren.

## Sicherheit und Ton

Keine Inhalte, die gefährliches Verhalten fördern, diskriminierend abwerten oder als ernsthafte gefährliche Handlungsanweisung missverstanden werden können. Humor darf absurd sein, aber nicht auf Kosten realer Gefährdung.

Kein Audio vorsehen oder referenzieren.

## Pflichtprüfung vor Ausgabe

Prüfe vor Erstellung der finalen Datei jeden Eintrag auf:

- richtige Kategorie
- keine exakten oder semantischen Duplikate
- ausschließlich erlaubte Felder
- alle Pflichtfelder vorhanden
- korrekte Feldtypen
- gültige Sprache/Übersetzung
- belastbare Quellen, wenn erforderlich
- alle `source_refs` existieren
- `verification.verified: true` bei sourced content
- keine erfundenen Zuschreibungen
- keine Systemfelder
- angemessene Länge
- keine Platzhalter-URLs und keine `example.invalid`-Werte

## Finale Lieferung

Erstelle am Ende eine **downloadbare `.json`-Datei** mit dem in der Kategorie-Handoff verlangten Dateinamen oder einem gleichwertig eindeutigen Dateinamen.

Die Datei selbst enthält ausschließlich valides JSON. Keine Markdown-Codefences, Kommentare oder Erläuterungen in der JSON-Datei.

Im Chat darfst du nach Erstellung nur kurz nennen:

- wie viele Einträge erstellt wurden
- Dateilink
- gegebenenfalls wichtige Recherche-/Qualitätshinweise

Stelle keine Rückfrage, wenn die Kategorie-Handoff alle nötigen Informationen enthält. Arbeite den Auftrag direkt ab.
