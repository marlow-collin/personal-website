# Conversation Roulette – standardisierte LLM-Anweisung v1

## Aufgabe

Erstelle neue hochwertige deutsche Gesprächsfragen bzw. Gesprächsimpulse für das Conversation Roulette. Verwende ausschließlich das kanonische Importformat aus `Conversation_Import_Template_v1.json` und `Conversation_Import_Format_v1.md`.

Du erhältst zusätzlich:

1. `Conversation_Content_LLM_Review.json` mit dem aktuellen D1-Bestand einschließlich aktiver und archivierter Fragen,
2. `Conversation_Generation_Brief.json` mit statistischer Auswertung, gewünschter neuer Anzahl und aktuellen Content-Lücken,
3. eine konkrete Chat-Nachricht mit eventuellen Zusatzvorgaben.

Lies alle bereitgestellten Dateien vollständig, bevor du Inhalte erzeugst.

## Prioritäten

1. Eigenständigkeit und Gesprächsqualität.
2. Keine exakten, sehr ähnlichen oder lediglich umformulierten Varianten vorhandener Fragen.
3. Gezieltes Schließen der im Generation Brief erkennbaren Lücken.
4. Breite thematische und sprachliche Vielfalt.
5. Strikte Einhaltung des Schemas.

Wenn sich diese Ziele widersprechen, hat Qualität Vorrang vor dem Erzwingen der gewünschten Menge.

## Prüfung gegen vorhandenen Content

- Prüfe den vollständigen bereitgestellten Review-Export zuerst auf identische und sehr ähnliche Gesprächsideen.
- Archivierte Fragen gelten ebenfalls als bereits vorhandener Content.
- Eine Frage ist nicht schon deshalb neu, weil sie anders formuliert ist.
- Erzeuge keine Varianten derselben Grundidee, nur um die Zielmenge zu erreichen.
- Behaupte nur dann, ein Inhalt sei neu bzw. noch nicht vorhanden, wenn der dafür relevante aktuelle Review-Export tatsächlich bereitgestellt wurde.

## Vielfalt

Vermeide insbesondere:

- repetitive Satzanfänge,
- Serien nahezu identischer `Was ist dein ...?`-Fragen,
- zu viele Fragen über Beziehungen, wenn andere Topics unterrepräsentiert sind,
- unnötige Mehrfachkategorisierung,
- künstlich tief klingende Fragen ohne echten Gesprächswert,
- mehrere Fragen, die denselben Gesprächsimpuls nur aus einem leicht anderen Blickwinkel wiederholen.

Mische unterschiedliche Formen, z. B. direkte Fragen, Rückblicke, Entscheidungen, hypothetische Situationen, Meinungsfragen und kurze Gesprächsimpulse. Nicht jeder Eintrag muss mit einem Fragezeichen enden.

## Kategorien

Erlaubt sind ausschließlich:

- `casual`
- `funny`
- `deep`
- `hypothetical`
- `would_you_rather`
- `stories`
- `debate`
- `chaotic`

Normalerweise 1–2 Kategorien pro Frage. Drei Kategorien sind nur bei klarer inhaltlicher Begründung zulässig.

## Intensität

- `light`: unkompliziert, wenig persönliche Offenlegung nötig.
- `medium`: persönlicher oder reflektierter, aber für die meisten passenden Situationen angenehm.
- `deep`: deutlich persönlicher, verletzlicher oder emotional anspruchsvoller.

`deep` als Kategorie und `deep` als Intensität sind unterschiedliche Dimensionen.

Als globale Zielorientierung gilt ungefähr: 45 % `light`, 40 % `medium`, 15 % `deep`. Der Generation Brief zeigt, wo der aktuelle Bestand davon abweicht.

## Topics

Jede Frage erhält 1–3 Topics aus genau diesem Vokabular:

`everyday`, `childhood`, `family`, `friendship`, `relationships`, `work`, `education`, `money`, `travel`, `food`, `culture`, `technology`, `future`, `values`, `identity`, `habits`, `goals`, `fears`, `memories`, `society`, `creativity`

Topics beschreiben den Inhalt. Sie sind nicht mit Kategorien oder Contexts austauschbar.

## Contexts und Gruppenfragen

- `contexts: []`: universell geeignet.
- `friends`: nur wenn die Freundschaftssituation für die Frage relevant ist.
- `dating`: nur wenn eine Dating-/romantische Kennenlernsituation relevant ist.
- `minParticipants: 3`: nur wenn die Frage wirklich drei oder mehr Personen benötigt bzw. deutlich davon lebt.

Contexts und Gruppenmarkierungen nicht inflationär verwenden.

## Generation Brief

Nutze die statistischen Daten im Generation Brief aktiv. Bevorzuge unterrepräsentierte Kategorien, Topics, Intensitäten und sinnvolle Kombinationen. Verstärke keine deutlichen Übergewichte, sofern die konkrete Chat-Nachricht nichts anderes verlangt.

Bei leerem oder sehr kleinem Bestand soll der erste Batch eine breite, repräsentative Grundlage über Kategorien, Topics und Intensitäten schaffen.

## Ausgabe

- Gib ausschließlich eine vollständige UTF-8-JSON-Datei im kanonischen Importformat aus.
- Erfinde keine IDs.
- Füge kein `status`-Feld hinzu.
- Füge keine Kommentare, Erklärfelder oder nicht definierte Metadaten in die JSON-Datei ein.
- Der Dateiname sollte sinnvoll sein, z. B. `Conversation_Content_Import_001.json`.
- Die Datei muss direkt in `/x/admin4/` validierbar sein.

Falls die gewünschte Anzahl ohne Qualitätsverlust und ohne relevante Dubletten nicht sinnvoll erreichbar ist, liefere weniger Einträge. Nenne außerhalb der JSON-Datei höchstens kurz den Grund; die JSON-Datei selbst bleibt schema-konform.
