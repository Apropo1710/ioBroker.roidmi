# Regeln für die Arbeit an diesem Repository

Diese Datei gilt für jeden, der hier Änderungen macht – Menschen und KI-Werkzeuge (Claude, ChatGPT/Codex, Copilot …). Sie wird bei jeder Sitzung zuerst gelesen und hat Vorrang vor eigenen Gewohnheiten.

## Projekt in einem Satz

ioBroker-Adapter für zwei Saugroboter in einer Instanz: Roidmi EVE Plus (`evePlus.*`) und Xiaomi X20+ (`x20Plus.*`). Aktueller Stand, offene Punkte und die verbindlichen Projektregeln stehen in [STATUS.md](STATUS.md) – vor jeder Änderung lesen.

## Dokumentation

- **`STATUS.md` ist die einzige Statusdatei.** Keine weiteren Status-, Plan-, Übergabe-, TODO- oder Notizdateien anlegen, auch nicht „vorübergehend“. Die CI schlägt fehl, wenn eine solche Datei auftaucht.
- `STATUS.md` beschreibt den aktuellen Stand, nicht den Weg dorthin. Bei jeder Änderung am Funktionsstand oder an offenen Punkten im **selben** Pull Request aktualisieren. Keine Commit-Hashes, Run-IDs oder Uhrzeiten eintragen.
- Weitere Dokumentation nur an diesen Stellen:
  - `README.md` – für Anwender: Installation, Konfiguration, Objektbaum
  - `docs/ARCHITECTURE.md` – Aufbau des Codes
  - `docs/PROTOCOL_NOTES.md` – MIoT-Zuordnungen, Datenformate, Erkenntnisse vom Gerät
  - `docs/ROOM_IMPORT.md` – Räume laden und reinigen
- Was nicht mehr stimmt, wird korrigiert oder gelöscht – nicht ergänzt oder „als veraltet markiert“.

## Arbeitsablauf

- `main` ist geschützt. Jede Änderung über einen Branch und einen Pull Request; der Branch wird nach dem Merge automatisch gelöscht.
- Vor dem Pull Request lokal ausführen: `npm run lint`, `npm test`, `npm run build`. Neue Logik bekommt Tests in `test/`.
- Codeänderungen erhöhen die Version in `package.json` und `io-package.json` und bekommen einen Eintrag in `io-package.json` → `common.news` (Deutsch und Englisch, höchstens 20 Einträge, neueste zuerst).
- Keine Reste hinterlassen: veraltete Branches, Dateien, Datenpunkte und Diagnosecode werden entfernt, nicht liegen gelassen. Entfernte Datenpunkte beim Adapterstart löschen.
- Code, Code-Kommentare und Log-Meldungen auf Englisch; Dokumentation und Antworten an den Nutzer auf Deutsch.

## Umgang mit den Geräten

- Keine Payloads auf Verdacht an ein Gerät senden. Erst die Ursache belegen, dann ändern.
- In Analysen klar trennen: **nachgewiesen**, **Hypothese**, **Vermutung**.
- Keine zusätzlichen Abfragen oder Poller ohne Notwendigkeit; beide Roboter bleiben voneinander unabhängig.
- Eine grüne CI ist kein Hardware-Nachweis. „Bestätigt“ steht in `STATUS.md` erst nach einem Test am echten Gerät.

## Sicherheit

Tokens, Passwörter, DIDs, Cloud-Sitzungen und persönliche Karten- oder Raumdaten gehören nie in Git, Tests, Issues oder Logs.
