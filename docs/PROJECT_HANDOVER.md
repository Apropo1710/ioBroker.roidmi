# Technische Übergabe – Roidmi ioBroker Adapter

> **Aktualitätskorrektur 14.11.2026:** Maßgeblich ist `STATUS.md` auf `feature/xiaomi-x20plus`. Zuletzt geprüfter Feature-Code-Head `68d3508ecb079bf81e31da5941a9f970fce69b89`, Adapterversion 0.1.67; GitHub Actions „Test and build adapter“ #341 (Run `43449224003`) für exakt diesen Head: completed / success. Letzte Codekorrektur: DID-Regex-Validierung in `src/lib/xiaomi-cloud-map.ts`. Die Mehrraum-Reinigungsmodus-Absicherung ist enthalten, aber der zugehörige Praxistest am X20+ bleibt offen. Der getrennte Repository-`main`-Branch steht auf Version 0.1.36; sein Build-Distribution-Run `43378078837` war erfolgreich. Alte Angaben zu Branch `main`, Version 0.1.7 und damaligen Cloud-Fehlerständen sind historische Momentaufnahmen.


**Historischer Ausgangsstand:** 01.11.2026  
**Repository:** https://github.com/Apropo1710/ioBroker.roidmi  
**Branch:** `main`  
**Aktueller Build-Commit:** `fd5baf50c09cfd84bec2b2d240f774dbc8d30222`  
**Letzte Quellcode-Korrektur:** `97783d7de8280227c1a3254cd8cc8b8bf9b2cb33`  
**Angezeigte Adapterversion:** `0.1.7` (GitHub-Installationskennung enthält den Commit)

Diese Datei ist die Übergabe für einen neuen Chat. Sie beschreibt den tatsächlichen Stand und trennt bestätigte Funktionen von noch offenen Live-Tests.

## 1. Projektziel

Entwicklung eines eigenständigen ioBroker-Adapters für den **Roidmi EVE Plus** (MIoT-Geräteprofil `roidmi.vacuum.v60`). Die lokale Steuerung und Statusabfrage haben Vorrang. Die optionale Xiaomi-Cloud-Anbindung dient ausschließlich dem manuellen Abruf der gespeicherten Karte und Raum-Metadaten.

Leitplanken:
- Möglichst aktuelle und nützliche Datenpunkte bei möglichst geringer Last für ioBroker und den Roboter.
- Änderungen nach Möglichkeit bündeln und in einem Build ausliefern.
- Keine Zugangsdaten, Tokens, Bestätigungscodes oder Sitzungstokens in Git oder Logs.
- CI-Erfolg ist kein Ersatz für einen Live-Test am echten EVE Plus.
- Vor Installation auf dem produktiven ioBroker ein Backup erstellen.

## 2. Repository und Entwicklungsablauf

- GitHub: [Apropo1710/ioBroker.roidmi](https://github.com/Apropo1710/ioBroker.roidmi)
- TypeScript-Quellen: `src/`
- Kompilierte Laufzeitdateien: `build/`
- Tests: `test/`
- Dokumentation: `docs/`
- CI: `.github/workflows/ci.yml`
- Distributionsbuild: `.github/workflows/build-dist.yml`

Wichtige Build-Eigenschaften:
- Node.js >= 20.
- `npm ci` verwendet die eingecheckte `package-lock.json`.
- `npm test`, `npm run build`, `npm run lint`.
- Der Workflow „Build distribution“ kompiliert und committet die `build/`-Dateien automatisch.
- Nach einem Quellcode-Commit können deshalb zwei Workflow-Läufe erscheinen: CI und Build distribution. Der Build-Commit kann anschließend einen weiteren CI-Lauf auslösen.

**Zuletzt geprüft:** CI und Build distribution für Quellcode-Commit `97783d7` waren erfolgreich. Der automatische Distributions-Commit ist `fd5baf50`. Das bestätigt Kompilierung und automatisierte Tests, nicht die Xiaomi-Anmeldung oder den Kartenabruf am echten Konto.

## 3. Aktueller Funktionsstand

### Lokal
- Lokaler miIO-Transport und MIoT-Kommunikation sind implementiert.
- Verbindung wird über `info.connection` und `info.connectionText` angezeigt.
- Status-/Einstellungsabfrage läuft standardmäßig alle 30 Sekunden.
- Die sieben konfigurierten Properties werden in **einem** `get_properties`-RPC abgefragt.
- Polling-Durchläufe überlappen nicht. Bei Fehlern greift Backoff; nach Erfolg wird auf das normale Intervall zurückgekehrt.
- Nur geänderte Werte werden in ioBroker geschrieben.
- Steuerbefehle für Start, Pause, Fortsetzen, Dock und Stop sind implementiert.
- Saugstufe, Reinigungsart und Wasserstufe sind als Datenpunkte angelegt.
- Raumimport aus JSON und einzelne Raum-Reinigungsdatenpunkte sind implementiert.
- Zeitplan SIID 8 / PIID 6 kann auf ausdrückliche Anforderung gelesen werden; er wird nicht regelmäßig abgefragt.

**Bisheriger Geräte-Live-Stand:** In einer früheren Installation waren lokale Verbindung und Statusabfrage bereits erfolgreich: `info.connection=true`, Poll-Zähler stieg, Akku 100 %, Laden aktiv, Fehlercode 0 und Saugstufe 2. Steuerbefehle und Raumreinigung müssen weiterhin jeweils am Gerät verifiziert werden.

### Optional: Xiaomi Cloud / Karte
- Cloud-Zugriff ist optional und standardmäßig deaktiviert.
- Keine periodischen Cloud-Aufrufe. Nur `control.refreshMap` startet den manuellen Abruf.
- Roidmi V60 verwendet den Cloud-Map-Key `0`; es wird bewusst **kein** zusätzliches lokales `get_map_v1` aufgerufen. Dieser Aufruf verursachte zuvor Firmware-seitig `miIO error -9999: user ack timeout`.
- Die Cloud-Sitzung wird in einer dauerhaften Instanz von `XiaomiCloudMapClient` gehalten.
- Der Datenpunkt `map.cloudVerificationCode` nimmt den SMS-/E-Mail-Code entgegen und wird nach Verarbeitung geleert.
- Nach erfolgreichem Kartenimport werden Räume in `map.roomsJson` bereitgestellt. Falls die separate Reinigungs-`mapId` im Archiv fehlt, muss diese weiterhin einmalig über `control.importRooms` ergänzt werden.

## 4. Datenpunkte und Bedienung

Wichtige Datenpunkte:
- `info.connection`, `info.connectionText`, `info.lastPoll`, `info.pollCount`
- `control.refreshMap`: manuellen Xiaomi-Cloud-Kartenabruf starten.
- `map.cloudStatus`: Status oder Fehlertext des Cloud-Abrufs.
- `map.cloudAuthUrl`: Authentifizierungs-URL, falls Xiaomi sie liefert.
- `map.cloudVerificationCode`: SMS-/E-Mail-Bestätigungscode schreiben.
- `map.cloudLastUpdate`: Zeitpunkt des letzten erfolgreichen Kartenabrufs.
- `map.roomsJson`, `map.config`, `map.mapId`
- `control.importRooms`: Raumkonfiguration als JSON importieren.
- `control.cleanRooms`: Einzel-/Mehrraum-Reinigung als JSON-Auftrag.
- `control.refreshTiming` und `timing.raw`: gespeicherten Reinigungszeitplan einmalig lesen.

Raumimport-Beispiel:
```json
{
  "mapId": 123456,
  "rooms": [
    { "id": 1, "name": "Küche" },
    { "id": 2, "name": "Wohnzimmer" }
  ]
}
```

Mehrraumauftrag:
```json
{ "mapId": 123456, "roomIds": [1, 2] }
```

Die IDs müssen aus der aktiven Karte stammen. Xiaomi DID, lokale miIO-Header-ID, Karten-ID und Segment-/Raum-IDs sind unterschiedliche Kennungen.

## 5. Aktueller offener Fehler – Xiaomi 2FA / Cloud-Karte

Dies ist die **oberste offene Baustelle**. Der Benutzer hat die aktuelle Version installiert und folgende Schritte/Fehlerbilder gemeldet:

1. Zunächst meldete der Adapter, Xiaomi habe keine unterstützte 2FA-Methode oder `identity_session` geliefert.
2. Der 2FA-Ablauf wurde daraufhin an den Referenzablauf aus AlexxIT/go2rtc angepasst:
   - `notificationUrl` aus `serviceLoginAuth2`
   - `/identity/list` zur Ermittlung des Flags (4 = Telefon, 8 = E-Mail) und der `identity_session`
   - `/identity/auth/verifyPhone|Email`
   - `/identity/auth/sendPhoneTicket|EmailTicket`
   - Code-Eingabe über ioBroker-Datenpunkt
   - `/identity/auth/verifyPhone|Email` mit `ticket`, `_flag`, `trust=false`
   - Weiterleitung zur STS-URL und Auslesen von Sitzungstokens
3. Danach kam die nächste Meldung: **„Xiaomi verification completed but no cloud security token was returned.“**
4. Daraufhin wurde `src/lib/xiaomi-cloud-map.ts` so geändert, dass `Extension-Pragma` auf **jedem Hop** der manuellen HTTP-Redirect-Kette geprüft wird, nicht nur in der letzten Antwort.
5. Diese letzte Änderung ist Quellcode-Commit `97783d7`; der erfolgreiche Build ist `fd5baf50`.

### Wichtig: Was noch nicht bewiesen ist
- Es ist **nicht** bestätigt, dass der Adapter nach der letzten Korrektur das `ssecurity`-Token erhält.
- `serviceToken`, `userId` und `ssecurity` müssen nach der 2FA vollständig aus der Xiaomi-STS-Weiterleitung bzw. deren Cookies/Headern übernommen werden.
- Danach müssen die verschlüsselten Xiaomi-Cloud-Aufrufe `/home/device_list` und `/v2/home/get_interim_file_url` erfolgreich sein.
- Erst wenn das Archiv geladen und geparst wurde, ist die Cloud-Kartenfunktion live bestätigt.

### Technische Prüfpunkte für den nächsten Chat
1. Referenzimplementierung `AlexxIT/go2rtc/pkg/xiaomi/cloud.go` vergleichen. Besonders `authStart`, `sendTicket`, `LoginWithVerify` und `finishAuth`.
2. Aktuelle Implementierung folgt Redirects manuell. Prüfen, ob die Response-Header und Cookies jedes Redirect-Hops vollständig ausgelesen werden und ob Xiaomi Headernamen/-werte anders liefert.
3. Xiaomi-Referenz sammelt Cookies aus der gesamten Redirect-Historie und liest `Extension-Pragma` aus den einzelnen Responses. Sicherstellen, dass `Headers.getSetCookie()` in der verwendeten Node.js-Version alle Cookies liefert; andernfalls robuste Set-Cookie-Verarbeitung ergänzen.
4. Die Login-Initialisierung und POST-Parameter mit dem Referenzclient vergleichen. Insbesondere `qs`, `callback`, `sid`, `_sign`, Geräte-Cookie und die JSON-Antwort mit `&&&START&&&` beachten.
5. Den Fehlerstatus differenziert ausgeben: ob `ssecurity`, `serviceToken` oder `userId` fehlt. Niemals Tokenwerte protokollieren.
6. Tests mit simulierten HTTP-Antworten/Redirect-Ketten hinzufügen. Tests müssen mindestens Cookie-Übernahme über mehrere Redirects, `Extension-Pragma` auf Zwischenantwort, Telefon-/E-Mail-Flag und ungültigen Code abdecken.
7. Nach Korrekturen CI und Distributionsbuild abwarten; erst dann den neuen GitHub-Build installieren und den Live-Test durchführen.

**Achtung:** Nicht behaupten, der Xiaomi-Cloud-Login funktioniere bereits. Der aktuelle Stand ist „Build erfolgreich, Live-Authentifizierung noch offen“.

## 6. Relevante Commits

| Commit | Zweck |
|---|---|
| `909d7af` | Roidmi V2 Cloud-Map-Key `0`; lokale Map-RPC entfernt |
| `fa66bbd` | Deterministische Installationen mit Lockfile vorbereiten |
| `270364a` | CI auf `npm ci` umstellen |
| `ae7c533` | Erste Xiaomi-2FA-Sitzungsimplementierung |
| `8a0a34a` | 2FA-Datenpunkt und Integration in `main.ts` |
| `4d5dab5` | 2FA-Ablauf an Xiaomi-Referenzclient anpassen |
| `97783d7` | `ssecurity` aus allen STS-Redirect-Antworten übernehmen |
| `fd5baf5` | Automatisch erzeugte Build-Dateien zum letzten Quellcode-Stand |

Vollständige Historie: https://github.com/Apropo1710/ioBroker.roidmi/commits/main

## 7. Vorgehen und Prioritäten

**Priorität 1 – Xiaomi-Cloud-Login fertigstellen**
- Fehlendes Token gezielt diagnostizieren und Redirect-/Cookie-Handling korrigieren.
- Automatisierte Tests für den Authentifizierungsablauf ergänzen.
- Cloud-Kartenabruf live bestätigen.

**Priorität 2 – Live-Validierung lokal**
- Gebündelte Sieben-Property-Abfrage und 30-Sekunden-Intervall am EVE Plus bestätigen.
- Start/Pause/Fortsetzen/Dock/Stop einzeln testen.
- Raumreinigung erst nach bestätigter Karten-ID und Segment-IDs testen.

**Priorität 3 – Protokoll und Dokumentation vervollständigen**
- Tatsächlich unterstützte Properties, Aktionen, Firmware und Fehlercodes dokumentieren.
- Offene Raumprofile und Zeitplan-Schreibzugriffe nicht auf Verdacht implementieren.
- Veröffentlichung/Adapter-Validierung erst nach Integrationstests.

## 8. Bekannte Sicherheits- und Lastregeln

- Keine Credentials/Tokens in GitHub-Issues, Logs oder Dokumentation.
- Cloud-Zugangsdaten nur in ioBroker-Adapterkonfiguration; ioBroker verschlüsselt sie.
- Cloud-Map-Abruf bleibt manuell und optional.
- Keine zusätzlichen Roboter-RPCs für Cloud-Login oder Kartenabruf, wenn vermeidbar.
- Keine Timing-Property schreiben: SIID 8 / PIID 6 überschreibt vorhandene Reinigungszeitpläne.
- Keine Raumprofil-Umschaltung durch bloßes Setzen globaler Einstellungen vor Raumreinigung; erst den echten App-Aufruf protokollseitig verifizieren.

## 9. Einstiegstext für einen neuen Chat

Diesen Text im neuen Chat innerhalb des Projekts verwenden:

> Wir setzen die Entwicklung des ioBroker-Adapters für den Roidmi EVE Plus fort. Bitte lies zuerst `docs/PROJECT_HANDOVER.md` im GitHub-Repository Apropo1710/ioBroker.roidmi vollständig und nutze sie als verbindliche technische Übergabe. Aktueller Stand: main, Build-Commit fd5baf50. Lokale Steuerung und gebündeltes 30-Sekunden-Polling sind implementiert; die Xiaomi-Cloud-2FA ist noch nicht live bestätigt. Der letzte Fehler war „Xiaomi verification completed but no cloud security token was returned“; Commit 97783d7 erfasst Extension-Pragma auf allen Redirect-Hops. Arbeite direkt am Repository weiter, prüfe den aktuellen Stand und mache die Xiaomi-Authentifizierung mit Tests fertig. Änderungen möglichst bündeln und erst nach erfolgreichem CI- und Distributionsbuild einen Installationsstand nennen. Keine Zugangsdaten erfragen oder loggen.


## 10. Live-Test nach Installation – 02.11.2026 (deutsche Zeit)

Adapterversion **0.1.29** wurde auf dem produktiven ioBroker installiert und gestartet. Der Benutzer hat folgende Live-Datenpunkte/Screenshots bestätigt:

- Adapterstart im Log erfolgreich; Raumkarte geladen: **5 Räume**.
- `info.connection = true`.
- `info.connectionText = Local MIoT connection established`.
- `info.lastPoll` wird aktualisiert; `info.pollCount` stieg auf mindestens **3**.
- Akku **100 %**, Fehlercode **0 / No error**, Roboterstatus **9** (docked/fully charged, empirische Zuordnung), Charging-Wert **1** (Bedeutung weiterhin nicht endgültig verifiziert), Saugstufe **2**, Wasserstufe **2**.
- Die Basis-Statusabfrage funktioniert live. **Steuerbefehle und Raumreinigung sind weiterhin nicht live verifiziert.** Noch keinen Start-/Pause-/Dock-/Raumreinigungsbefehl als erfolgreich bezeichnen.
- Xiaomi-Cloud-2FA-Sperre ist am 02.11.2026 noch aktiv. Nutzer plant, Cloud-Anmeldung und Cloud-Funktion erst **morgen (03.11.2026)** fortzusetzen. Bis dahin keine weiteren Login-/Code-Anfragen und keine Cloud-Live-Tests.
- Letzter Quellcode-Commit mit Befehlsfehlerklassifizierung: `129b5ec77168815fef6bcd60f52959665d4bac44`. CI und Distribution Build für diesen Commit sind beide erfolgreich.

**Nächster sinnvoller Ablauf:** Am 03.11.2026 zuerst die Xiaomi-2FA-Sperre beim Nutzer bestätigen lassen, dann einen einzelnen Cloud-Login-Versuch durchführen. Vorher lokale Statusabfrage nicht unnötig intensivieren; Standard-Polling von 30 Sekunden beibehalten.
