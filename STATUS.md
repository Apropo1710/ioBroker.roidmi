# Projektstatus – ioBroker.roidmi

Stand: 23.11.2026 · Adapterversion **0.1.76** · Branch **`main`**

Dies ist die einzige Statusdatei des Projekts. Sie beschreibt den aktuellen Stand, nicht den Weg dorthin.
Die Entwicklungsgeschichte steht im Git-Log und in den Versionshinweisen (`io-package.json` → `common.news`).

## Kurzüberblick

- Ein Adapter für zwei Roboter, beide unabhängig aktivierbar und mit eigenem Polling:
  - **Roidmi EVE Plus** (`roidmi.vacuum.v60`) unter `roidmi.0.evePlus.*`
  - **Xiaomi Robot Vacuum X20+** (`xiaomi.vacuum.c102gl`) unter `roidmi.0.x20Plus.*`
- Installation in ioBroker: Admin → Adapter → „Aus eigener Quelle installieren“ → GitHub → `Apropo1710/ioBroker.roidmi` (Branch `main`).
- HomePilot (Android-App) nutzt die Datenpunkte des Adapters für Status, Steuerung, Räume und Zeitpläne.
- Automatisierte Prüfung: `npm run lint`, `npm test`, `npm run build` laufen in der CI bei jedem Push auf `main`.

## Funktionsstand übergreifend

| Funktion | Stand |
|---|---|
| Neustart-Erkennung über den Handshake-Zähler, Einstufung von Ausfällen im Log (0.1.70) | bestätigt (X20+-Neustart 23.11. als Info gemeldet; EVE-Plus-Ausfall ohne Neustart als Warnung) |
| `info.connection` auf Instanzebene für die Admin-Anzeige (0.1.71) | bestätigt |
| Token nach WLAN-Wechsel aus der Xiaomi-Cloud übernehmen: Knopf in den Instanzeinstellungen (0.1.74) oder `<roboter>.control.refreshToken` (0.1.73) | bestätigt (beide Roboter nach dem WLAN-Wechsel am 23.11.) |
| Ersteinrichtung ohne Token: Cloud-Anmeldung ohne Roboter-Token, Token-Knopf findet den Roboter ohne DID über die IP und ergänzt die DID (0.1.75); Einstellungsseite in der Reihenfolge der Einrichtung: 1. Xiaomi-Konto, 2. Roboter, 3. Optionen (0.1.76) | implementiert, Test einer Ersteinrichtung ausstehend |
| Verbindungsstatistik je Roboter über gleitende Fenster (24 h / 7 Tage): `info.timeouts…`, `failedPolls…`, `restarts…`, `lastRestart` (0.1.72) | bestätigt; ein Ausfall durch Neustart zählt auch bei `failedPolls` und `timeouts` mit |

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

1. **MIoT-Timeouts – Ursachen geklärt, Beobachtung läuft** (Auswertung Adapter-Debuglog + Dauer-Ping, 20.–22.11.2026):
   - **Nächtlicher Neustart des X20+:** Der Roboter startet jede Nacht zwischen etwa 3 und 5 Uhr neu und ist dabei rund 30 s nicht erreichbar (belegt über den Gerätezähler im Handshake: 19.11. ca. 04:12, 20.11. 04:49, 21.11. 03:04, 22.11. 03:42). Alle nächtlichen Warnungen fallen darauf. Auch der EVE Plus startet gelegentlich selbst neu.
   - **Paketverlust im WLAN:** Die Fritzbox (unten, beim X20+) und der UniFi-AP Büro (oben, mit dem der X20+ verbunden ist) sendeten beide auf 2,4-GHz-Kanal 1. Nach der Kanaltrennung am 21.11. sank der Ping-Verlust zum X20+ von 0,41 % auf 0,16 %, abends von bis zu 1 % auf praktisch 0; die ersten Fehlversuche des X20+ gingen von 24 in 34 h auf 4 in 21 h zurück.
   - **Seit 0.1.70** erkennt der Adapter Neustarts am Handshake-Zähler und meldet einen dadurch verursachten Ausfall als Info. Ein Ausfall ohne Neustart wird weiterhin als Warnung gemeldet, allerdings erst beim nächsten Poll; längere Ausfälle warnen einmal und melden die Wiederherstellung.
   - WLAN-Zuordnung seit 23.11.: Beide Roboter hingen über Kreuz am WLAN der anderen Etage. Jetzt ist der X20+ (unten) mit der Fritzbox und der EVE Plus (oben) mit dem UniFi-AP Büro verbunden, beide über die App ohne Zurücksetzen umgestellt. Dabei hat sich jeweils der Token geändert (siehe 0.1.73). Wirkung mit `<roboter>.info.timeouts24h/7d` prüfen.
2. **Statusbedeutungen EVE Plus:** Die Texte für Status 5/6 und Ladestatus 1/2 sind empirisch und vorläufig (siehe `docs/PROTOCOL_NOTES.md`).
3. **Firmware-Stand** der Testgeräte ist nicht dokumentiert. Bitlagen (z. B. X20+-Wasserstufe) sind nur für die getesteten Geräte belegt.
4. **Mögliche Erweiterungen**, nicht begonnen: Reinigungsverlauf; Umbenennung des Adapters (der Name passt seit dem X20+ nicht mehr ganz; ändert alle Datenpunkt-IDs, erfordert Neueinrichtung der Instanz und Anpassung von HomePilot), sinnvoll spätestens bei Aufnahme ins offizielle ioBroker-Repository. Zonenreinigung wird nicht benötigt.
5. **Aufteilung von `src/main.ts`** (rund 2.100 Zeilen) pro Roboter, wenn größere Erweiterungen anstehen.

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
- Keine zweite Status-, Plan- oder Übergabedatei anlegen; die CI schlägt sonst fehl. Technische Details gehören nach `docs/PROTOCOL_NOTES.md`.
- Arbeitsregeln für Menschen und KI-Werkzeuge stehen in `AGENTS.md` (`CLAUDE.md` verweist darauf).
