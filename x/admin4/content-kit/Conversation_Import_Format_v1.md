# Conversation Roulette – Importformat v1

Dieses Format ist die einzige zulässige Form für neue Conversation-Inhalte. Die mitgelieferte Template-Datei enthält bewusst einen Platzhalter und dient nur als Strukturreferenz; sie kann nicht unverändert importiert werden.

## Top-Level

```json
{
  "schemaVersion": 1,
  "questions": []
}
```

Es sind keine weiteren Top-Level-Felder erlaubt.

## Frage

Jeder Eintrag in `questions` enthält exakt diese Felder:

- `text`: nicht-leerer deutscher Fragetext oder Gesprächsimpuls, maximal 600 Zeichen.
- `categories`: 1–3 Werte. Normalfall 1–2.
- `intensity`: exakt `light`, `medium` oder `deep`.
- `topics`: 1–3 Werte aus dem kanonischen Topic-Vokabular.
- `contexts`: Array mit 0–2 Werten; erlaubt sind `friends` und `dating`.
- `minParticipants`: `null` oder `3`. Der Wert `3` ist nur für echte Gruppenfragen gedacht.

Neue Importdateien enthalten niemals `id`, `status`, Zeitstempel oder technische Hashes. Neue Fragen werden beim Import automatisch als `active` gespeichert und erhalten serverseitig eine stabile ID.

## Kategorien

`casual`, `funny`, `deep`, `hypothetical`, `would_you_rather`, `stories`, `debate`, `chaotic`

## Topics

`everyday`, `childhood`, `family`, `friendship`, `relationships`, `work`, `education`, `money`, `travel`, `food`, `culture`, `technology`, `future`, `values`, `identity`, `habits`, `goals`, `fears`, `memories`, `society`, `creativity`

## Context-Regel

`contexts: []` bedeutet universell geeignet. `friends` oder `dating` werden nur gesetzt, wenn die Frage spezifisch von diesem Kontext profitiert. Sie sind keine allgemeinen Themen-Tags.

## Duplikate

Der Import blockiert exakte normalisierte Duplikate sowohl innerhalb einer Datei als auch gegen den gesamten vorhandenen D1-Bestand – einschließlich archivierter Fragen. Textuell sehr ähnliche Fragen können zusätzlich als Warnung erscheinen und müssen im Preview geprüft werden.
