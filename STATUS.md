# Projektstatus – ioBroker.roidmi

Stand: 19.11.2026 · Adapterversion **0.1.69** · Branch **`main`**

Dies ist die einzige Statusdatei des Projekts. Sie beschreibt den aktuellen Stand, nicht den Weg dorthin.
Die Entwicklungsgeschichte steht im Git-Log und in den Versionshinweisen (`io-package.json` → `common.news`).

## Kurzüberblick

- Ein Adapter für zwei Roboter, beide unabhängig aktivierbar und mit eigenem Polling:
  - **Roidmi EVE Plus** (`roidmi.vacuum.v60`) unter `roidmi.0.evePlus.*`
  - **Xiaomi Robot Vacuum X20+** (`xiaomi.vacuum.c102gl`) unter `roidmi.0.x20Plus.*`
- Installation in ioBroker: Admin → Adapter → „Aus eigener Quelle installieren“ → GitHub → `Apropo1710/ioBroker.roidmi` (Branch `main`).
- HomePilot (Android-App) nutzt die Datenpunkte des Adapters für Status, Steuerung, Räume und Zeitpläne.
- Automatisierte Prüfung: `npm run lint`, `npm test`, `npm run build` laufen in der CI bei jedem Push auf `main`.

## Funktionsstand Roidmi EVE Plus

| Funktion | Stand |
|---|---|
| Lokale Verbindung, Status-Polling (gebündelt, max. 6 Properties pro RPC) | bestätigt |
| Start, Pause, Rückkehr zur Station | bestätigt |
| Fortsetzen (`resume`) | implementiert, nicht separat bestätigt |
| Raumreinigung (einzeln/mehrere Räume, SIID 14 / AIID 1) | bestätigt |
| Karte und Räume über Xiaomi Cloud (manuell über `control.refreshMap`) | bestätigt |
| Raumprofile (Saugstärke/Wasser pro Raum) aus den Kartendaten lesen | bestätigt – geändert werden sie bewusst nur in der Xiaomi-App |
| Zeitpläne lesen (SIID 8 / PIID 6) | bestätigt |
| Bestehende Zeitpläne bearbeiten (`control.updateSchedule`, mit Readback) | bestätigt |
| Automatischer Zeitplanabruf (optional, Standard aus) | implementiert |

## Funktionsstand Xiaomi X20+

| Funktion | Stand |
|---|---|
| Lokale Verbindung, Status-Polling | bestätigt |
| Start, Pause/Fortsetzen, Rückkehr zur Station | bestätigt (`stop` wurde entfernt, verhielt sich wie Pause) |
| Saugleistung (`suction`), Reinigungsart (`cleaningMode`), Wasserstufe (`mopMode`), jeweils in beide Richtungen mit der Xiaomi-App | bestätigt |
| Teppich-Boost (`carpetBoost`) | bestätigt |
| Raumkarte/Räume über Xiaomi Cloud (`control.refreshRooms`) | bestätigt |
| Raumreinigung: einzelne Räume, mehrere Räume (auch mehr als drei, verschiedene Kombinationen) | bestätigt |
| Raumreinigung in „Saugen vor Wischen“ und „Saugen und Wischen gleichzeitig“ | bestätigt |
| Zeitpläne lesen, automatisch abgleichen, aktivieren/deaktivieren, bestehende bearbeiten | bestätigt |
| Kindersicherung, Fortsetzen nach dem Laden, Orten (`locate`) | implementiert, Live-Test nicht dokumentiert |

## Offene Punkte

1. **Sporadische MIoT-Timeouts** (beide Roboter, unabhängig voneinander): Der automatische zweite Versuch fängt fast alle Fälle ab; vereinzelt scheitert auch er (20./21.11.: 3 Warnungen in rund 34 Stunden, alle X20+).
   - Auswertung 20./21.11.2026 (Adapter-Debuglog + Dauer-Ping auf den X20+, ca. 18,5 Stunden): Der Ping verliert ohne Ausfall der WLAN-Anmeldung rund 0,4 % der Pakete, überwiegend einzeln und gehäuft in Phasen. Der X20+ hatte 24 erste Fehlversuche in rund 34 Stunden (ca. 0,3 % der Abfragen), der EVE Plus 15. Das passt in der Größenordnung zum Paketverlust.
   - Eine Warnung (21.11., 03:03) fiel in eine Funkpause von rund 25 Sekunden, in der auch der Ping ausfiel. Eine weitere (20.11., 22:11) lag in einer Phase gehäufter Ping-Verluste.
   - Folgerung: Ursache ist Paketverlust auf der WLAN-Strecke, kein Fehler im Adapter oder im Paketaufbau. Die Fritzbox zeigt keine Ab- oder Anmeldungen der Roboter. Ein Ping alle 2 Sekunden kann einen einzelnen verlorenen RPC nicht sicher belegen; dass der miIO-Dienst der Firmware zusätzlich gelegentlich nicht antwortet, ist nicht ausgeschlossen, aber nicht nötig, um die Zahlen zu erklären.
   - Hebel liegen beim WLAN (Empfang an der Station, Repeater, Kanal). Im Adapter wäre nur eine andere Einstufung möglich, z. B. Warnung erst nach mehreren fehlgeschlagenen Polls in Folge.
2. **Statusbedeutungen EVE Plus:** Die Texte für Status 5/6 und Ladestatus 1/2 sind empirisch und vorläufig (siehe `docs/PROTOCOL_NOTES.md`).
3. **Instanzstatus im Admin:** Es gibt nur `evePlus.info.connection` und `x20Plus.info.connection`, kein `info.connection` auf Instanzebene. Der Admin kann den Verbindungsstatus der Instanz deshalb nicht anzeigen.
4. **Firmware-Stand** der Testgeräte ist nicht dokumentiert. Bitlagen (z. B. X20+-Wasserstufe) sind nur für die getesteten Geräte belegt.
5. **Mögliche Erweiterungen** aus dem früheren Projektplan, nicht begonnen: Zonenreinigung, Reinigungsverlauf, Aufnahme ins offizielle ioBroker-Repository.
6. **Aufteilung von `src/main.ts`** (rund 2.100 Zeilen) pro Roboter, wenn größere Erweiterungen anstehen.

## Verbindliche Projektregeln

- Zielgeräte sind Roidmi EVE Plus und Xiaomi X20+ – nicht mit anderen Modellen (z. B. Mova) verwechseln.
- So wenige MIoT-RPCs wie möglich: keine zusätzlichen Poller für einzelne Datenpunkte, keine überlappenden Polls, Diagnose aus vorhandenen Antworten ableiten.
- Nur geänderte States schreiben; langsam veränderliche Werte seltener abfragen.
- Adapter und Original-App müssen dieselben Einstellungen sehen (keine adaptereigenen Profile oder Kopien).
- Beide Roboter bleiben unabhängig: Ein Fehler beim einen darf den anderen nicht beeinflussen.
- Keine Payloads auf Verdacht an ein Gerät senden; erst Ursache belegen, dann ändern. Nachgewiesenes, Hypothesen und Vermutungen klar trennen.
- Zugangsdaten, Tokens, DIDs und Sitzungsdaten nie in Git, Issues, Screenshots oder Logs.
- CI-Erfolg ist kein Hardware-Nachweis. Ein Punkt gilt erst nach Live-Test am Gerät als „bestätigt“.

## Pflege dieser Datei

- Bei jeder Änderung, die den Funktionsstand oder die offenen Punkte betrifft, diese Datei im selben Commit anpassen.
- Keine Commit-Hashes, Run-IDs oder Uhrzeiten eintragen – die stehen im Git-Log und in GitHub Actions.
- Keine zweite Status-, Plan- oder Übergabedatei anlegen. Technische Details gehören nach `docs/PROTOCOL_NOTES.md`.
