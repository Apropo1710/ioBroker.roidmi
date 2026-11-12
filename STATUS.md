# Projektstatus – ioBroker.roidmi

## X20+ Wasserstufe in gepacktem Reinigungssetting (11.11.2026)

- Drei Messungen aus der Xiaomi-Original-App bestätigen die Codierung in SIID 4 / PIID 23:
  - Grad 1: `67585` / `0x10801`
  - Grad 2: `133121` / `0x20801`
  - Grad 3: `198657` / `0x30801`
- Ausschließlich Bits 16–17 ändern sich. Dekodierung: `(rawValue >>> 16) & 0x03`; Werte 1/2/3 entsprechen Grad 1/2/3.
- Implementierung auf Branch `feature/xiaomi-x20plus`: `status.mopMode` und `control.mopMode` lesen nun das Feld aus 4/23. Die bisherige separate Abfrage 4/5 für mopMode entfällt, wodurch ein Property aus dem normalen Poll entfällt.
- Schreiben von `control.mopMode`: aktuellen 4/23-Rohwert einmal lesen, ausschließlich Maske `0x30000` ersetzen und danach 4/23 einmal zurücklesen. `cleaningMode` bleibt in den unteren Bits `0x03`; beide Schreibpfade erhalten jeweils die anderen Bits.
- Adapterversion auf **0.1.49** erhöht.
- Code-Commits: `202e21a39c1c4efce76fbbbdae9ceb007c883728` (Hauptlogik), `7725da997278ada813fa1f2c7a50e1bef9f2e44c` (Pollprofil).
- Verifikation für Code-Head `515e2686abedb672fdd9bd6a3bc25ed0782fce42`: CI #399 und Test/Build #171 erfolgreich (Tests, Lint, Build und Paketprüfung). Artefakt-ID `13851653198` heruntergeladen und geprüft: inneres `package.json` meldet **0.1.49**; kompiliertes `build/main.js` enthält Wasserstufen-Dekodierung und Schreibmaske `0x30000`/Shift 16. ZIP-/Tar-Dateiname trägt weiterhin die bekannte veraltete Kennzeichnung `0.1.35`; tatsächliche Paketversion ist korrekt 0.1.49.
- **Live-Test am 11.11.2026 erfolgreich:** Der Nutzer hat die Wasserstufe mehrfach in beide Richtungen umgestellt. Änderungen in der Xiaomi-Original-App werden im Adapter korrekt angezeigt; Änderungen über `x20Plus.control.mopMode` erscheinen korrekt in der Original-App. Damit ist die 4/23-Codierung einschließlich Schreibbarkeit auf dem realen X20+ bestätigt.
- Die Wasserstufenintegration gilt damit auf dem getesteten Gerät und dessen Firmwarestand als hardwarevalidiert. Kein weiterer Diagnosepoll und keine zusätzliche MIoT-Abfrage erforderlich; die Umsetzung nutzt weiterhin den vorhandenen schnellen Poll und gezielte Einzelabfragen nur beim Schreiben.
- Protokollherkunft: Der Hinweis auf SIID 4 / PIID 23 als gepackten Wert stammt aus dem X20+-Support des Projekts `ha-xiaomi-vacuum`. Claude hat die passende Spur dorthin aufgezeigt; die konkrete Bitlage wurde anschließend anhand der drei Messwerte und des bidirektionalen Live-Tests am Gerät bestätigt.
- Bitdokumentation: Wasserstufe liegt im getesteten Gerät in Bits 16–17 (`mask 0x30000`, `shift 16`); Dekodierung `(rawValue >>> 16) & 0x03`. Rohwerte: Grad 1=`0x10801`, Grad 2=`0x20801`, Grad 3=`0x30801`. Andere Bits müssen beim Schreiben erhalten bleiben.
- Firmware-Version des Testgeräts: derzeit nicht dokumentiert. Die Bitlage ist deshalb nur für das getestete Gerät/Firmware belegt; eine firmwareübergreifende Gleichheit ist nicht nachgewiesen. Bei einem späteren Firmwarevergleich die Version ergänzen.

## Verbindliche Projektregeln

- Zielgerät dieses Adapters: Roidmi EVE Plus und separat Xiaomi X20+; niemals mit Mova1000 verwechseln.
- Möglichst wenige MIoT-RPCs; Diagnose aus bestehendem Polling ableiten.
- Keine zusätzlichen Poller nur für einzelne Datenpunkte; keine überlappenden Polls.
- Nur geänderte States schreiben; langsam veränderliche Werte seltener abfragen.
- Adapter und Xiaomi-Original-App müssen dieselben Einstellungen sehen und gemeinsam nutzen.
- Draft-PR #3 nicht ohne ausdrückliche Freigabe mergen.
- STATUS.md bei jeder zusammenhängenden Änderung auf dem aktiven Branch fortschreiben.

## X20+ Live-Befund: Wasserstatus während laufender Reinigung (11.11.2026)

- Während „Saugen vor Wischen“ zeigte die Xiaomi-App Wasser Grad 3, während `status.mopMode` im ioBroker weiter „Mittel (2)“ anzeigte.
- Der vorhandene Diagnosewert `info.cleanSettingReadback` lieferte lokal SIID 4 / PIID 23 mit `code: 0` und Rohwert `198659` (= `0x30803`). Bits 16–17 ergeben eindeutig Grad 3. Der Zeitstempel des öffentlichen `status.mopMode` blieb bei 12:52:44, obwohl der Poll um 13:13/13:16 erfolgreich weiterlief.
- Zusätzlich waren die öffentlichen Werte `cleaningMode=1` und `mopMode=2` nicht mit dem gelesenen Rohwert synchron. Das belegt einen Fehler in der Statusübernahme, nicht in der Geräteantwort oder der bereits bestätigten Bitmaske.
- Korrektur auf Branch `feature/xiaomi-x20plus`, Commit `d41e5813c1d36363c7b701c290908bcd5b0b2e07`: Die Wasserstufe wird jetzt direkt anhand der Antwort auf SIID 4 / PIID 23 dekodiert und in `status.mopMode` sowie `control.mopMode` übernommen. Die Dekodierung ist damit von der separaten Low-Bit-Zuordnung für `cleaningMode` entkoppelt. Es wird keine zusätzliche MIoT-Abfrage eingeführt.
- Build/CI-Verifikation für diese Korrektur erfolgreich: CI #403 (Run `43023797362`) sowie Test/Build #175 (Run `43023797367`) liefen erfolgreich durch; Tests, Lint, Build und Paketprüfung sind grün. Der Roboter wurde während der Diagnose nicht zusätzlich abgefragt oder gesteuert.
- **Live-Nachtest nach Installation von 0.1.49 erfolgreich (11.11.2026, 14:14 Uhr):** Screenshot während der laufenden Reinigung bestätigt `control.mopMode = Hoch (3)` und `status.mopMode = Hoch (3)`; außerdem `status.cleaningMode = 3` (Saugen vor Wischen). Damit ist die zuvor beobachtete veraltete Statusanzeige mit dem korrigierten Build auf dem realen Gerät behoben. Keine weitere Aktion am Roboter erforderlich.

## Beobachtung: sporadische Xiaomi-X20+ miIO-RPC-Timeouts nach Installation 0.1.49 (11.11.2026, ca. 13:48–14:03)

- Nutzer-Screenshots zeigen Warnungen für `Xiaomi X20+ batch 1/2` (13:48:55 und 13:52:31) sowie `batch 2/2` (14:03:41): `timed out; retrying this batch once`.
- Debug-Trace zeigt UDP-RPC-Aufrufe an `192.168.178.96:54321` mit 4.000-ms-Timeout. Beim 13:52-Versuch waren rund 30.025 ms seit dem letzten erfolgreichen RPC vergangen; beim 14:03-Versuch rund 38 ms. Der Trace zeigt Handshake-Wiederverwendung bzw. Invalidierung nach fehlgeschlagenem RPC und anschließenden frischen Handshake.
- Die Screenshots belegen zunächst den Timeout des ersten Versuchs und den vorgesehenen einmaligen Retry. Ob jeder Retry erfolgreich war oder einzelne Pollzyklen vollständig ausfielen, ist anhand der sichtbaren Ausschnitte nicht abschließend erkennbar.
- Noch kein bestätigter Geräte- oder Adapterfehler und keine Änderung vorgenommen. Während der Stabilitätsbeobachtung Häufigkeit, Retry-Ausgang und zeitlichen Zusammenhang mit laufender Reinigung weiter erfassen. Keine zusätzlichen Polls/Diagnoseabfragen einführen.

## Zeitliche Einordnung der X20+-RPC-Timeouts und Handshake-Optimierung (11.11.2026)

- Korrektur der bisherigen Interpretation: Die sporadischen miIO-RPC-Timeouts bestanden bereits vor der am Morgen des 11.11.2026 eingeführten Handshake-Wiederverwendung. Die Wiederverwendung ist daher nicht die Ursache der ursprünglich beobachteten Timeouts.
- Claude hatte die Handshake-Wiederverwendung erst am Morgen als Optimierungsansatz vorgeschlagen; sie ist eine nachträgliche Änderung und bislang nicht als wirksame Verbesserung nachgewiesen.
- Die am Nachmittag gezeigten Timeout-Logs sind zeitlich nach dieser Änderung entstanden. Sie können zur Bewertung des neuen Verhaltens dienen, erklären aber nicht den ursprünglichen Fehler.
- Untersuchung muss deshalb bei der bereits vorher bestehenden UDP/miIO-Kommunikation ansetzen. Handshake-Wiederverwendung separat als Optimierungsversuch betrachten und nicht ohne Vergleich als Ursache oder Lösung deklarieren.
- Keine Codeänderung aufgrund dieser Korrektur; Wasserstufen-Fix bleibt unverändert.

## miIO-Codeprüfung: Fehler im experimentellen Handshake-Reuse gefunden (11.11.2026)

- Im aktuellen `MiioClient` wurde ein konkreter Zustandsfehler im experimentellen Reuse-Pfad gefunden: Bei einem RPC mit wiederverwendetem Handshake bleibt `handshakeHeader` zunächst `undefined`. Der erste UDP-Rücklauf (die eigentliche RPC-Antwort) wird dadurch fälschlich als frischer Handshake interpretiert und löst einen zweiten RPC-Versand aus. Das kann zu doppelten Anfragen und unzuverlässiger Antwortzuordnung führen.
- Dieser Fehler betrifft ausschließlich den nachträglich eingeführten Handshake-Reuse-Pfad und erklärt ausdrücklich **nicht** die ursprünglichen Timeouts, die bereits vor dieser Optimierung auftraten.
- Sicherheitsmaßnahme umgesetzt: X20+ nutzt wieder `reuseHandshake: false` und damit den zuvor verwendeten vollständigen Handshake vor jedem RPC. Commit: `0f2ec23c07b58b7766217c114037e7ee94be0e36`.
- Der ursprüngliche Timeout bleibt separat offen. Die bisherigen Logs zeigen erfolgreiche Handshake-Antwort und erfolgreiches UDP-Senden, danach aber keine passende RPC-Antwort innerhalb des Zeitfensters. Als nächster Untersuchungsansatz bleiben Antwortverlust/UDP-Fragmentierung, Roboterlast und Fremdclient-Interaktionen. Keine Belege erlauben derzeit eine eindeutige Ursache.
- Build/CI für das Deaktivieren des Reuse-Pfads steht noch aus. Die Wasserstufen-Korrektur wurde nicht verändert.

## Experimentelle miIO-Handshake-Wiederverwendung repariert (11.11.2026)

- Der konkrete Fehler im Reuse-Pfad wurde behoben: Wenn ein gültiger Handshake-Cache vorhanden ist, wird `handshakeHeader` vor Empfang der UDP-Pakete mit den gecachten Geräteinformationen initialisiert. Damit wird das erste eingehende Paket korrekt als RPC-Antwort behandelt und nicht fälschlich als neuer Handshake interpretiert; der RPC wird nicht doppelt gesendet.
- Die Zeitstempel-Extrapolation aus dem Cache bleibt aktiv. Bei einem fehlgeschlagenen RPC wird der Cache weiterhin verworfen, sodass der nächste Versuch wieder mit einem frischen Handshake beginnt.
- X20+ verwendet den reparierten Pfad wieder mit `reuseHandshake: true`. Es kommen keine zusätzlichen Polls oder RPCs hinzu; pro Aufruf entfällt im Erfolgsfall lediglich der separate Handshake-Austausch.
- Die ursprünglichen sporadischen RPC-Timeouts bestanden bereits vor dieser Optimierung und bleiben ein separates Beobachtungsthema. Die Reparatur ist zunächst durch CI/Build zu verifizieren und anschließend am realen Gerät zu beobachten.
- Wasserstufen-Decodierung und bestätigte Live-Funktion bleiben unverändert.

## Handshake-Reuse: Regressionstest und Release-Kandidat 0.1.50 (11.11.2026)

- Ergänzender UDP-Integrationstest deckt jetzt den zuvor fehlenden Reuse-Pfad ab: erster RPC mit Handshake, zweiter RPC mit Cache, genau ein RPC pro Aufruf und keine Fehlinterpretation der RPC-Antwort als Handshake.
- Versionsstände in `package.json`, `package-lock.json` und `io-package.json` auf **0.1.50** angeglichen; News-Eintrag ergänzt.
- Der reparierte Reuse-Pfad bleibt für den X20+ aktiviert. Freigabe zur Installation erst nach erfolgreichem Test-/Build-Workflow und Prüfung des erzeugten Installationsartefakts.

## Laufende Praxistest-Übersicht (Stand 11.11.2026, 23:20 Uhr)

Diese Übersicht ist die maßgebliche aktuelle Testliste. Bei jedem neuen Testbefund, Screenshot, Log oder Code-/Versionswechsel aktualisieren. Nicht bestätigte Funktionen ausdrücklich offen lassen.

### Stabilität und Kommunikation – Version 0.1.50

- **Handshake-Reuse im automatisierten Test: BESTANDEN.** UDP-Integrationstest prüft zwei aufeinanderfolgende RPC-Aufrufe: nur der erste benötigt einen Handshake, jeder Aufruf sendet genau ein RPC; die RPC-Antwort des zweiten Aufrufs wird nicht als Handshake fehlinterpretiert.
- **CI / Test / Lint / Build / Paketprüfung: BESTANDEN.** Commit `d6e39c139d45b3f936d838cacd6da116380e2679`; CI Run `43038055971`, Test-/Build-Run `43038056023`; beide erfolgreich. Artefakt-ID `13863154285`.
- **Live-Stabilitätsbeobachtung: LÄUFT.** Nutzer-Screenshot vom 11.11.2026 um 23:20 Uhr zeigt den Start von Version 0.1.50 um 15:59:11 Uhr und als neueste Logeinträge die erfolgreiche Initialisierung um 15:59:20 Uhr. Seit dem Neustart somit rund 7 Stunden 21 Minuten; laut Nutzer bis zum Screenshot keine Fehler im Log. Das ist ein positiver Zwischenstand, noch kein Langzeittest.
- Weiter beobachten: sporadische RPC-Timeouts, Verhalten nach längeren Kommunikationspausen, Polling während laufender Reinigung und Stabilität über mehrere Tage. Keine zusätzlichen Diagnosepolls einführen und währenddessen keine Änderungen am Kommunikationscode vornehmen.
- Historische Timeout-Einordnung bleibt bestehen: sporadische RPC-Timeouts wurden bereits vor Einführung der Handshake-Wiederverwendung beobachtet. Eine Verbesserung durch 0.1.50 ist noch nicht abschließend bewiesen.

### Funktionstests Xiaomi X20+

| Funktion | Status | Nachweis / nächster Schritt |
|---|---|---|
| Wasserstufe zwischen Xiaomi-App und ioBroker in beide Richtungen | BESTANDEN | Live-Test am 11.11.; siehe Wasserstufenabschnitt |
| Wasserstufe im Status während laufender Reinigung | BESTANDEN | Korrigierter Status in `status.mopMode` und `control.mopMode` live bestätigt |
| Reinigungsmodus / `cleaningMode` | **BESTANDEN** | Vom Nutzer als in beide Richtungen live bestätigt korrigiert: ioBroker ↔ X20+ ↔ Xiaomi-Original-App. Nicht mit `suction` verwechseln. |
| Saugleistung / Saugstufen (`suction`) | **BESTANDEN** | Der Nutzer bestätigt, dass `suction` vollständig getestet wurde. Die Saugleistungsfunktion gilt als komplett bestätigt; sie ist ausdrücklich vom separaten Datenpunkt `cleaningMode` zu unterscheiden. |
| Globale Reinigungsart umschalten | OFFEN | Nur bei Gelegenheit im normalen Betrieb testen |
| Globalen Reinigungsstart aus ioBroker | **BESTANDEN** | Live-Test am 12.11.2026: Start über `x20Plus.control.start`; Nutzer bestätigt, dass der X20+ losgefahren ist. Screenshot danach: `vacuumState=1`, `taskStatus=1`, `chargingState=2`, `cleaningArea=0`, `cleaningTime=0`, `workMode=2`. |
| Raumkartenimport | BESTANDEN | Neustartlog meldet erfolgreich geladene Karte mit 5 Räumen |
| Raum-ID-Zuordnung und gezielte Raumreinigung | OFFEN | Noch kein dokumentierter Live-Test |
| Teppich-Boost | **BESTANDEN** | Live-Test nach Korrektur des Schreibwerts erfolgreich: `control.carpetBoost` schaltet den Teppich-Boost; die boolesche ioBroker-Einstellung wird als MIoT-`uint8` (0/1) geschrieben und gezielt zurückgelesen. Nutzerbestätigung am 12.11.2026. |
| Pause / Fortsetzen | **BESTANDEN** | Live-Test am 12.11.2026: `control.pause` hält den Roboter an und die Sprachausgabe meldet „Reinigung pausiert“. `control.start` setzt anschließend laut Sprachausgabe „Ich setze die Reinigung fort“ fort; `cleaningArea` stieg von 4 auf 13 und `cleaningTime` von 3 auf 12, ohne Reset. `taskStatus` und `vacuumState` blieben während Pause und Fortsetzung jeweils auf 1; sie unterscheiden den Pausenzustand somit nicht. |
| Stop-Funktion | **ABGESCHLOSSEN – aus X20+-Adapter entfernt** | Live-Test ergab dasselbe Verhalten wie `pause` (SIID 2 / AIID 2). Deshalb wurde `x20Plus.control.stop` ab Version 0.1.51 bewusst nicht mehr angelegt/verarbeitet. Kein offener Test; `pause` und `returnToDock` bleiben die getrennten unterstützten Funktionen. |
| Rückkehr zur Ladestation (`returnToDock`) | **BESTANDEN** | Live-Test am 12.11.2026: Nutzer startete manuell über `control.start` und löste anschließend `control.returnToDock` aus. X20+ fuhr zur Station, entleerte den Staubbehälter, lädt nun; Xiaomi meldete „Reinigung abgeschlossen“. Einzelne Aktion SIID 3 / AIID 1 genügt; keine Kombination mit Pause/Stop oder Änderung von `resumeAfterCharging` erforderlich. |

### Testreihenfolge und Belastungsregeln

1. Stabilitätsbeobachtung von 0.1.50 hat Vorrang. Keine unnötigen Steuerbefehle nur für Tests.
2. Funktionstests möglichst in ohnehin geplante Reinigungsabläufe integrieren und jeweils nur eine Funktion gezielt prüfen.
3. Vor einem Test prüfen, ob er zusätzliche Roboterkommunikation oder eine laufende Reinigung erfordert; keine zusätzlichen Poller oder parallelen Abfragen einführen.
4. Nach jedem Ergebnis Status von OFFEN auf BESTANDEN, FEHLGESCHLAGEN oder TEILWEISE BESTÄTIGT setzen und Datum, Version sowie knappen Nachweis ergänzen.
5. Bei Änderungen an Code, Paketversion, aktivem Branch oder PR-Status diese Übersicht und den Projektstatus im selben Commit aktualisieren. Beim Branchwechsel die aktuelle STATUS.md mitführen; keine abweichende veraltete Testliste stehen lassen.

### Korrektur Saugleistungstest (11.11.2026)

- Der Nutzer hat klargestellt, dass die Saugleistung über den Datenpunkt `suction` vollständig bestätigt wurde.
- Die frühere Einstufung „teilweise bestätigt“ beruhte auf einer Verwechslung bzw. Vermischung mit dem separaten Datenpunkt `cleaningMode` und wird zurückgenommen.
- **Saugleistung / `suction`: BESTANDEN.** Nicht erneut als offenen Test führen und keine erneute Prüfung dafür einplanen.
- `cleaningMode` ist ebenfalls vollständig bestätigt: Änderungen wurden in beide Richtungen zwischen ioBroker, Roboter und Xiaomi-Original-App nachvollzogen. Die frühere Einstufung „teilweise bestätigt“ war falsch. `cleaningMode` und `suction` bleiben getrennte Datenpunkte; beide gelten als BESTANDEN.


## Stabilitätsbeobachtung 0.1.50 – einzelner seltener RPC-Ausfall (12.11.2026, 04:45 Uhr)

- Nutzer-Screenshot vom 12.11.2026 zeigt einen seltenen fehlgeschlagenen X20+-Poll:
  - 04:45:45.399: Batch 1/2 mit den Statusfeldern `vacuumState`, `battery`, `chargingState`, `cleaningTime` und `cleaningMode` läuft in den miIO-Timeout; ein einmaliger Retry wird gestartet.
  - 04:45:49.738: Auch der Retry schlägt fehl (`retry failed: miIO request timed out`).
  - 04:45:49.762: Der übergeordnete X20+-Poll meldet entsprechend `poll failed: miIO request timed out`.
- Der Nutzer bewertet solche Ausfälle inzwischen als selten. Das ist gegenüber den zuvor häufiger beobachteten Timeouts ein positiver Stabilitätshinweis, aber noch keine statistisch belastbare Langzeitbewertung.
- **Entscheidung: Die Handshake-Wiederverwendung aus 0.1.50 bleibt unverändert aktiv.** Aufgrund dieses einzelnen seltenen Ausfalls wird sie weder zurückgenommen noch verändert. Es gibt keinen Beleg, dass die Handshake-Änderung diesen Timeout verursacht; die sporadischen Timeouts wurden bereits vor ihrer Einführung beobachtet.
- Weiter normale Nutzung und Logs beobachten. Keine zusätzlichen Polls, Diagnoseabfragen oder Änderungen am miIO-Kommunikationscode allein aufgrund dieses Ereignisses.


## Weiteres Vorgehen nach Stabilitätsbeobachtung (12.11.2026)

- Die seltenen miIO-RPC-Timeouts von Version 0.1.50 werden bei normaler Nutzung weiter beobachtet. Die Handshake-Wiederverwendung bleibt unverändert; keine vorsorgliche Rücknahme oder Kommunikationsänderung.
- Parallel werden die noch offenen Funktionstests schrittweise bei ohnehin geplanten Reinigungsabläufen durchgeführt. Es werden dafür keine zusätzlichen Poller oder Diagnoseabfragen eingerichtet.
- Bereits vollständig bestätigte Funktionen werden nicht erneut als Testaufgabe eingeplant:
  - Saugleistung `suction`: bidirektional BESTANDEN.
  - Reinigungsmodus `cleaningMode`: bidirektional BESTANDEN.
  - Wasserstufe `mopMode`: bidirektional BESTANDEN, einschließlich Status während laufender Reinigung.
  - Raumkartenimport: BESTANDEN.
- Verbleibende Funktionstests in sinnvoller Reihenfolge und nur bei passender Gelegenheit:
  1. Globale Reinigungsart umschalten.
  2. Globalen Reinigungsstart aus ioBroker auslösen.
  3. Raum-ID-Zuordnung und gezielte Raumreinigung.
  4. Pause und Fortsetzen sind bereits bestanden.
  5. Rückkehr zur Ladestation ist bereits bestanden.
  6. Teppich-Boost ist bestanden; die separate Stop-Funktion wurde nach dem Live-Test als Duplikat von Pause aus dem X20+-Adapter entfernt. Keine Wiederholung einplanen.
- Nach jedem tatsächlich durchgeführten Test wird nur der betreffende Matrixeintrag mit Datum, Adapterversion und konkretem Ergebnis aktualisiert. Keine Tests als bestanden markieren, bevor ein Live-Nachweis vorliegt.


## X20+ Funktionstest: globaler Reinigungsstart aus ioBroker (12.11.2026)

- Ausgangszustand vor dem Befehl laut Screenshot: Roboter an der Station, `vacuumState=13` / „Ladung abgeschlossen“, `chargingState=1`, Akku 100 %, `taskStatus=0`, `cleaningTime=65`, `cleaningArea=49`.
- Der globale Start wurde über `x20Plus.control.start` ausgelöst.
- Nutzer bestätigt unmittelbar danach: „Er ist losgefahren nach Start“.
- Folgender Screenshot zeigt den geänderten Gerätezustand: `vacuumState=1`, `taskStatus=1`, `chargingState=2`, `cleaningTime=0`, `cleaningArea=0`, `workMode=2`. Das bestätigt die Annahme des Startbefehls und den Beginn des Vorgangs.
- **Ergebnis: GLOBALER REINIGUNGSSTART AUS IOBROKER BESTANDEN** (Live-Test am realen X20+).
- Auffälligkeit für die Statusbeobachtung: Im Screenshot steht `statusText` noch auf „Ladung abgeschlossen“, obwohl `vacuumState=1` bereits den neuen Zustand meldet. Prüfen, ob der Text-State beim nächsten regulären Poll aktualisiert wird; zunächst kein Codeeingriff und kein zusätzlicher Poll.
- Der Start-State `x20Plus.control.start` steht nach Ausführung wieder auf `false`, wie für den Taster vorgesehen.


### Nachbeobachtung globaler Start (12.11.2026, ca. 07:59 Uhr)

- Weiterer Screenshot während der laufenden Reinigung: `vacuumState=1`, `taskStatus=1`, `chargingState=2`, `cleaningArea=2`, `cleaningTime=0`, Akku 99 %.
- Der Roboter ist damit weiterhin im aktiven Reinigungszustand; die Reinigungsfläche ist gegenüber dem Start-Screenshot von 0 auf 2 gestiegen.
- **Status-Text-Auffälligkeit bestätigt:** `statusText` zeigt weiterhin „Ladung abgeschlossen“, obwohl `vacuumState=1` und `taskStatus=1` sind. Das ist nicht nur ein kurzer Aktualisierungsversatz direkt nach dem Start. Als separaten Statusanzeige-Befund für spätere Codeanalyse vormerken; während des laufenden Funktionstests keine Änderung vornehmen.
- `cleaningTime=0` bleibt in diesem frühen Screenshot unverändert; weiter beobachten, ob der Wert später ansteigt bzw. ob die Einheit/Granularität Minuten sind.


### Weitere Laufzeitbeobachtung globaler Start (12.11.2026, ca. 08:01 Uhr)

- Neuer Screenshot während derselben Reinigung: `vacuumState=1`, `taskStatus=1`, `chargingState=2`; `cleaningArea=4` (zuvor 2), `cleaningTime=3` (zuvor 0), Akku 98 %.
- Damit steigen sowohl Reinigungsfläche als auch Reinigungszeit im laufenden Vorgang; die Statuswerte werden grundsätzlich aktualisiert.
- `statusText` zeigt weiterhin fälschlich „Ladung abgeschlossen“ trotz `vacuumState=1`. Der veraltete Text ist damit mehrfach über mehrere Polls hinweg reproduziert und als separater Status-Text-Bug zu behandeln.
- Der globale Start bleibt BESTANDEN. Keine Änderung am laufenden Roboter oder zusätzliche Abfrage für diese Beobachtung.


### Einordnung `cleaningArea` während laufender Reinigung (12.11.2026)

- Rückfrage des Nutzers: Der Roboter blieb zwischen den Screenshots im selben Raum, obwohl `cleaningArea` von 2 auf 4 stieg.
- Wichtig: `cleaningArea` ist der MIoT-Messwert für gereinigte Fläche (SIID 4 / PIID 3), kein Raumzähler und kein Hinweis auf einen Raumwechsel. Ein Anstieg während der Roboter innerhalb desselben Raums weiterarbeitet, ist daher plausibel.
- Die Screenshots zeigen nur die Rohwerte 0 → 2 → 4. Die genaue Einheit/Skalierung ist anhand dieser Screenshots allein nicht verifiziert; keine Umrechnung oder m²-Angabe als gesichert ausgeben.
- Die vorherige Formulierung „Fläche steigt“ bezieht sich auf den Flächen-Messwert, nicht auf einen Raumwechsel.


## X20+ Funktionstest: Pause und Fortsetzen (12.11.2026, ca. 08:08–08:13 Uhr)

- Während einer laufenden globalen Reinigung wurde `x20Plus.control.pause` ausgelöst. Der Roboter hielt an und meldete akustisch „Reinigung pausiert“.
- Screenshot im Pausenzustand: `cleaningArea=4`, `cleaningTime=3`, `taskStatus=1`, `vacuumState=1`, Akku 98 %.
- Anschließend wurde `x20Plus.control.start` ausgelöst. Der Roboter meldete akustisch „Ich setze die Reinigung fort“.
- Screenshot nach der Fortsetzung: `cleaningArea=13`, `cleaningTime=12`, `taskStatus=1`, `vacuumState=1`, Akku 95 %. Beide laufenden Reinigungszähler wurden nicht auf null zurückgesetzt, sondern stiegen weiter.
- **Ergebnis: PAUSE BESTANDEN, FORTSETZEN ÜBER START BESTANDEN.** Die akustischen Ansagen und die fortlaufenden Zähler belegen das Verhalten am realen Gerät.
- `taskStatus` und `vacuumState` blieben in den gezeigten Screenshots auch im angehaltenen Zustand auf 1. Diese States bilden die Pause daher offenbar nicht eindeutig ab; keine Statussemantik daraus ableiten.
- Im Adaptercode sind `pause` und `stop` derzeit beide auf SIID 2 / AIID 2 gemappt. Da der Roboter auf `pause` dennoch eindeutig „Reinigung pausiert“ meldet und sich mit `start` fortsetzen lässt, muss die tatsächliche Semantik des separaten `stop`-Befehls noch live geprüft werden. Bis dahin keine Codeänderung an der Aktionszuordnung.


### X20+ Funktionstest: Stop-Befehl zeigt Pausenverhalten (12.11.2026)

- Der Nutzer hat zusätzlich `x20Plus.control.stop` ausgelöst.
- Der Roboter meldete auch dabei akustisch „Reinigung pausiert“.
- Damit bestätigt sich das im Code sichtbare Mapping: `pause` und `stop` verwenden beide SIID 2 / AIID 2 und lösen nach dem Live-Befund dasselbe Pausenverhalten aus.
- **Bewertung:** Der Datenpunkt `stop` führt derzeit nicht nachweisbar zu einem endgültigen Abbruch, sondern verhält sich wie `pause`. Als separate Stop-Funktion ist er daher noch nicht bestanden. Nicht vorschnell ummappen: Erst Protokoll-/Original-App-Semantik prüfen, bevor ein anderer MIoT-Befehl implementiert wird.


## X20+ Original-App-Test: manuelle Rückkehr zur Station (12.11.2026, ca. 08:20–08:21 Uhr)

- Der Nutzer hat während einer laufenden Reinigung in der Xiaomi-Original-App „Zurück zur Station“ ausgelöst.
- Die Original-App zeigte vor der Bestätigung den Dialog: „Die aktuelle Reinigung beenden und zum Aufladen zur Ladestation zurückkehren?“ Das ist ein eindeutiger Hinweis, dass dieser manuelle Vorgang die aktuelle Reinigung beendet und nicht lediglich pausiert.
- Nach Bestätigung zeigte die App „Rückkehr läuft“. Die App-Anzeige der bisherigen Reinigung lag bei 15 m² und 14 Minuten.
- Zeitgleicher ioBroker-Screenshot: `battery=93`, `cleaningArea=13`, `cleaningTime=14`, `chargingState=5`, `taskStatus=1`, `vacuumState=1`. Die beiden Reinigungszähler blieben auf dem bisherigen Vorgang; der Status-Screenshot allein belegt noch nicht, dass der Roboter bereits angedockt oder das Laden begonnen hat.
- Anschließend erschien auf dem Android-Gerät die Xiaomi-Benachrichtigung „Reinigung abgeschlossen“.
- **Zwischenergebnis:** Die Original-App bezeichnet die manuelle Rückkehr ausdrücklich als Beenden der aktuellen Reinigung. Das ist klar von der zuvor getesteten Pause mit Fortsetzung über `control.start` zu unterscheiden. Der Adapter-Datenpunkt `returnToDock` verwendet bereits eine separate Aktion (SIID 3 / AIID 1); die Übereinstimmung mit dem Original-App-Verhalten muss noch durch einen eigenen Adapter-Live-Test bestätigt werden.
- **Noch offen:** tatsächliches Andocken/Ladebeginn nach dieser Sequenz und ob nach dem Laden eine automatische Fortsetzung erfolgt. Der Screenshot mit der Benachrichtigung „Reinigung abgeschlossen“ spricht für einen beendeten Auftrag; ein späterer Neustart wurde bislang nicht beobachtet/bestätigt.


### Abschlussbeobachtung manuelle Rückkehr: Roboter bleibt an der Station (12.11.2026)

- Nutzer bestätigt: Der X20+ hat nach dem manuellen Zurückkehren angedockt, lädt und bleibt an der Station. Dieses Verhalten ist aus früherer Nutzung bekannt; zusätzlich zeigte die Xiaomi-App „Reinigung abgeschlossen“.
- Damit ist für den getesteten Ablauf belegt: Manuelle Rückkehr aus der laufenden Reinigung beendet den Auftrag und führt nicht zur automatischen Fortsetzung nach dem Laden.
- Adaptercode-Prüfung: `x20Plus.control.returnToDock` sendet bereits eine einzelne MIoT-Aktion SIID 3 / AIID 1. `pause` und `stop` senden separat SIID 2 / AIID 2. `resumeAfterCharging` ist eine eigene boolesche Einstellung (SIID 4 / PIID 11), kein notwendiger zusätzlicher Befehl für manuelle Rückkehr.
- **Technische Schlussfolgerung:** Der vorhandene Datenpunkt `x20Plus.control.returnToDock` sollte für den manuellen Vorgang genügen; keine Kombination mit `pause`, `stop` oder einem Schreibzugriff auf `resumeAfterCharging` vornehmen. Die Xiaomi-App-Bestätigung „Reinigung beenden und ... zurückkehren“ passt zur Semantik dieser separaten Dock-Aktion.
- **Noch nicht direkt hardwarevalidiert:** Die identische Aktion wurde bislang über die Xiaomi-Original-App ausgelöst, nicht über `x20Plus.control.returnToDock` im Adapter. Ein einmaliger Live-Test dieses Datenpunkts bei einer später ohnehin laufenden Reinigung kann die Adapterzuordnung bestätigen. Keine zusätzliche Aktion erforderlich, solange der Roboter bereits lädt.


### X20+ Adapter-Live-Test: ReturnToDock (12.11.2026)

- Der Nutzer hat eigens einen kurzen Reinigungsvorgang über `x20Plus.control.start` gestartet und danach direkt `x20Plus.control.returnToDock` ausgelöst. Es wurde keine geplante Reinigung unterbrochen.
- Ergebnis am realen Gerät: Der X20+ fuhr ordnungsgemäß zur Ladestation, führte dort die automatische Absaugung aus und lädt jetzt.
- Die Xiaomi-App meldete „Reinigung abgeschlossen“. Der Roboter bleibt an der Station; keine automatische Fortsetzung.
- **Ergebnis: `x20Plus.control.returnToDock` BESTANDEN.** Der vorhandene einzelne MIoT-Aufruf SIID 3 / AIID 1 bildet die manuelle Rückkehr einschließlich Beenden des aktuellen Reinigungsauftrags korrekt ab. Keine Kombination mit `pause` oder `stop` und keine Änderung an `resumeAfterCharging` erforderlich.
- Damit sind Original-App-Verhalten und Adapterbefehl übereinstimmend live bestätigt. Keine Codeänderung nötig.


## Version 0.1.51 – X20+ Stop-Datenpunkt entfernt

- `x20Plus.control.stop` wird nicht mehr angelegt oder verarbeitet.
- Beim Adapterstart wird der alte Datenpunkt auf bestehenden Installationen mit `delObjectAsync` entfernt.
- `pause` bleibt SIID 2 / AIID 2; `returnToDock` bleibt SIID 3 / AIID 1. Beide Funktionen sind am realen X20+ erfolgreich getestet.
- Der Stop-Datenpunkt des Roidmi EVE Plus bleibt unverändert.
- Versionsstände in `package.json`, `package-lock.json` und `io-package.json` auf 0.1.51 angehoben.


## X20+ Raumreinigung: MIoT-Timeout diagnostizieren (12.11.2026)

- Beim ersten gezielten Test für Segment 8 (Flur unten) wurde der Schreibwert `{"rooms":[{"segmentId":8}]}` korrekt angenommen und vom Adapter verarbeitet. Der Eingabedatenpunkt `x20Plus.control.cleanRooms` wird danach absichtlich geleert.
- Ergebnis in `x20Plus.control.cleanRoomsStatus`: `Room-clean request rejected/failed: miIO request timed out`. Damit ist die lokale MIoT-RPC-Antwort ausgeblieben; es ist **nicht** bewiesen, ob der Roboter den Auftrag empfangen oder ausgeführt hat.
- Codeprüfung: Der X20+-miIO-Client speichert bereits einen begrenzten UDP-Diagnosetrace im Speicher. Bisher wurde dieser Trace bei Status-Pollfehlern ausgegeben, aber nicht bei Fehlern des Raumreinigungsbefehls.
- Diagnoseänderung in Commit `377f92a`: Trace vor dem Raumreinigungsaufruf zurücksetzen und bei einem fehlgeschlagenen Raumreinigungsbefehl als Debugmeldungen ausgeben. Keine Wiederholung des nicht-idempotenten Reinigungsbefehls, keine Änderung an Payload oder Timeout und keine zusätzliche Roboterabfrage.
- **Noch nicht gebaut/getestet/installiert.** GitHub Actions CI für Commit `377f92a` wurde durch PR #3 ausgelöst und war bei der letzten Abfrage noch in der Warteschlange.
- Nächster Schritt: CI-Ergebnis abwarten. Falls erfolgreich, Diagnoseversion installieren und den Logtrace nach einem kontrollierten Test auswerten. Bis dahin keine weiteren Raumreinigungsversuche.

- CI-Ergebnis nach der ersten Diagnoseänderung: Build schlug fehl, weil der Trace zunächst als lokale Variable in `onReady` deklariert war, der Zustands-Handler aber in einer anderen Methode darauf zugreifen muss (`TS2304: Cannot find name 'xiaomiMiioTrace'`). Ursache identifiziert.
- Korrektur in Commit `0c8fcc5`: Der begrenzte X20+-miIO-Trace ist jetzt ein Adapter-Klassenfeld und wird sowohl beim Polling als auch beim Raumreinigungsbefehl verwendet. Keine Änderung am Roboterprotokoll oder am Reinigungsbefehl.
- CI für den Korrektur-Commit muss noch vollständig durchlaufen; bis dahin keine Installation.


## X20+ Raumreinigung: Transportursache gefunden und korrigiert (12.11.2026)

- Debugtrace des Live-Versuchs (09:25:31): Der Adapter verwendete einen wiederverwendeten lokalen miIO-Handshake, sendete den RPC-Aufruf `miIO.miotspecv2` erfolgreich an `192.168.178.96:54321`, erhielt aber innerhalb von 4 Sekunden keine RPC-Antwort. Handshake wurde danach verworfen.
- Entscheidender Codevergleich: Die normalen X20+-Steuerbefehle (Start, Pause, Rückkehr) verwenden bei vorhandener Xiaomi-Cloud-Sitzung bereits `XiaomiCloudMapClient.callAction` über `/miotspec/action`. Die Raumreinigung war dagegen fest auf den lokalen UDP-Aufruf verdrahtet. Der Log belegt außerdem eine wiederhergestellte Xiaomi-Cloud-Sitzung. Damit war der Raumreinigungsbefehl inkonsistent zum bewährten Transport der übrigen X20+-Aktionen.
- Korrektur in Commit `cba3e2d`: Raumreinigung verwendet nun ebenfalls die vorhandene Xiaomi-Cloud-Sitzung und denselben `callAction`-Transport wie Start/Pause/ReturnToDock; die vollständigen Room-clean-Inputs (einschließlich `selects`) werden übergeben und eine erneuerte Cloud-Sitzung wie bei den anderen Befehlen gespeichert. Nur wenn keine Cloud-Sitzung vorhanden ist, bleibt der lokale miIO-Fallback bestehen.
- Der Roboter wurde durch die Codeänderung nicht angesprochen. Der erneute Hardwaretest ist erst nach erfolgreichem CI/Build vorgesehen.


## X20+ Raumreinigung: MIoT-Parameterformat korrigiert (12.11.2026)

- Nach dem Wechsel auf Xiaomi Cloud MIoT antwortet die Cloud nun mit `code: -704220025`. Das ist laut Xiaomi MIoT-Fehlercode-Tabelle `action arguments count mismatch` (Anzahl der Aktionsparameter stimmt nicht). Damit ist die Cloud-Verbindung funktionsfähig; der Request-Aufbau war falsch.
- Codevergleich mit offizieller Xiaomi MIoT-Implementierung: Die Aktionsparameter `in` müssen als geordnete Liste der reinen Werte übermittelt werden. Der Adapter übergab bislang stattdessen die internen `{piid, value}`-Deskriptoren.
- Korrektur in Commits `a55e364` und `1329843`: neue Funktion `getXiaomiRoomCleanActionParams` serialisiert die Inputs als `[18, JSON-String]`; sowohl Cloud- als auch lokaler MIoT-Transport verwenden nun dieses korrekte Format.
- Regressionstest in Commit `f56d8a0`: prüft für Segment 8 genau zwei Aktionsparameter und den erwarteten JSON-Inhalt `selects: [[8,1,1,2,1]]`.
- CI/Build für diese Änderung noch ausstehend. Keine weitere Reinigung starten, bis CI erfolgreich ist.


## X20+ Raumreinigung: Cloud-Validierung verwirft firmware-spezifische Eingaben (12.11.2026)

- Nach dem Cloud-Transportwechsel und dem Test mit Segment 8 antwortete Xiaomi weiterhin mit `-704220025` (Action-Parameteranzahl stimmt nicht). Die Logs zeigen Warnungen bei 10:17:28, 10:17:40 und 10:18:49. `cleanRooms` wird nach Verarbeitung absichtlich geleert; die sichtbare Fehlermeldung steht in `cleanRoomsStatus`. Das erklärt, warum der Eingabewert nicht rot stehen bleibt.
- Die hardwarevalidierte unabhängige C102GL-Implementierung `ilirdokle43/HA-Xiaomi-Vacuum-Local` bestätigt: SIID 4 / AIID 1 benötigt firmwarebedingt zwei Eingaben: PIID 1 = 18 und PIID 10 = JSON-String. Der lokale miIO-Transport sendet diese als `in: [{piid,value}, ...]`. Die veröffentlichte MIoT-Spezifikation beschreibt dagegen nur eine Eingabe; daher lehnt der Cloud-Endpunkt die firmware-spezifische Zwei-Input-Erweiterung ab.
- Korrektur: Raumreinigung wird wieder ausschließlich lokal über `miIO.miotspecv2` gesendet, mit beiden PIID/Value-Deskriptoren. Zusätzlich kann `MiioClient.call(..., forceFreshHandshake=true)` einen frischen Handshake erzwingen. Das adressiert den vorherigen lokalen Timeout mit einem ca. 1900 Sekunden alten gecachten Handshake, ohne den allgemeinen Polling-/Befehlsverkehr zu verändern.
- Commits: `fb49c25` (frischer Handshake-Parameter), `ec01bb5` (lokale Zwei-Input-Raumreinigung), `d1c4f60` und `76323eb` (falsche Raw-Value-Serializer-Hilfsfunktion und Test entfernt).
- Frühere Annahme, rohe Werte `[18, json]` seien für den X20+-Befehl korrekt, ist ausdrücklich verworfen. Der passende Hardwarebeleg verlangt `[{piid:1,value:18},{piid:10,value:json}]`.
- CI/Build für den korrigierten Stand noch ausstehend. Bis erfolgreichem Build nicht installieren und keine weiteren Raumreinigungsversuche durchführen.


## X20+ Raumreinigung: erzwungener Handshake tatsächlich nicht erzwungen (12.11.2026)

- Live-Test nach Installation der vorherigen Version (10:28:56) zeigte erneut lokalen miIO-RPC-Timeout. Trace belegte weiterhin `reusing handshake` und `cached handshake +14s`, obwohl der Aufruf `call(..., undefined, true)` bereits `forceFreshHandshake` aktivierte.
- Ursache im Code gefunden: Der Client berechnete `cachedHandshake` unter Berücksichtigung von `forceFreshHandshake`, prüfte beim tatsächlichen Versand aber irrtümlich erneut `this.cachedHandshake`. Dadurch wurde trotz erzwungenem frischen Handshake die alte Sitzung benutzt.
- Korrektur Commit `d6e5ee2`: Der Versandzweig prüft jetzt die bereits korrekt gefilterte Variable `cachedHandshake`. Damit wird bei `forceFreshHandshake=true` tatsächlich ein neuer Handshake gesendet.
- Regressionstest Commit `58b1964`: baut zwei normale RPCs (mit Handshake-Wiederverwendung) und danach einen Aufruf mit `forceFreshHandshake=true`; prüft, dass ein zweiter Handshake und genau ein RPC pro Aufruf erfolgen.
- Vorherige Installationsversion hat den erzwungenen frischen Handshake nicht ausgeführt. Keine weitere Hardwareaktion durchführen, bis der neue CI-Lauf erfolgreich ist.

- CI #221/#449 schlug beim TypeScript-Build fehl (nicht bei `npm ci`): `TS18048 cached is possibly undefined` in der Handshake-Wiederverwendungsstelle. Ursache: Der Branch prüfte `cachedHandshake`, las danach aber erneut `this.cachedHandshake`, wodurch TypeScript die sichere Eingrenzung verlor.
- Korrektur Commit `2ab646f`: Der Versandzweig verwendet jetzt direkt das zuvor geprüfte lokale `cachedHandshake`. Das bewahrt die erzwungene Umgehung des Caches und stellt zugleich die TypeScript-Typprüfung sicher. Neuer CI-Lauf ausstehend.


## X20+ Raumreinigung: RPC-Umschlag an Referenz angepasst (12.11.2026)

- Unabhängige Analyse durch Claude hat einen weiteren konkreten Protokollunterschied gefunden. Der aktuelle Adapter sendete lokal `miIO.miotspecv2` mit `params: [{method:"action", params:{...}}` (verschachtelte Liste). Die hardwaregetestete C102GL-Referenz sendet dagegen direkt `method: "action"` mit einem einzelnen `params`-Objekt. Die inneren Eingaben `[{piid:1,value:18},{piid:10,value:JSON.stringify({selects:[[8,1,1,2,1]]})}]` stimmen überein.
- Der Unterschied erklärt plausibel das Schweigen des Roboters. Die Ursache ist durch Quellcodevergleich belegt; dass genau dies den Hardware-Timeout behebt, muss noch am Gerät bestätigt werden.
- Änderungen in Commits `1f64cd1`, `4c9fd70`, `29def6e`: MiioClient und Paketbuilder akzeptieren jetzt sowohl Array- als auch Objektparameter; Raumreinigung sendet direkt `call("action", {did,siid,aiid,in}, undefined, true)`, also den gleichen äußeren RPC-Aufbau wie die Referenz. Frischer Handshake bleibt nur für diesen Befehl aktiv.
- Regressionstest Commit `369f1d1`: prüft den entschlüsselten MIoT-Request einschließlich `method:"action"` und Objekt-Parametern.
- Die frühere Hypothese, `miIO.miotspecv2` mit verschachteltem `action` sei für diesen lokalen Aufruf korrekt, ist verworfen. Der zuvor implementierte frische Handshake bleibt erhalten; die allgemeine Handshake-Wiederverwendung wird nicht geändert.
- CI/Build für diesen Stand noch ausstehend. Bis zum erfolgreichen CI nicht installieren.


## X20+ gezielte Raumreinigung erfolgreich hardwaregetestet (12.11.2026)

- Nach Umstellung des lokalen MIoT-RPC-Umschlags auf `method: "action"` mit Objekt-Parametern wurde die gezielte Raumreinigung erstmals erfolgreich ausgeführt.
- Testdatenpunkt: `x20Plus.control.cleanRooms`; Payload `{"rooms":[{"segmentId":8}]}` für Flur unten.
- Roboter hat den Befehl angenommen, ist nachweislich in den gewünschten Raum gefahren und hat dort mit der Reinigung begonnen.
- MIoT-Antwort im Screenshot: `{"did":"1142042722","siid":4,"aiid":1,"out":[],"code":0}`. Zusammen mit der beobachteten tatsächlichen Fahrt bestätigt dies die Funktion hardwareseitig.
- Damit ist gezielte Raumreinigung für den Xiaomi X20+ (C102GL) erstmals erfolgreich bestätigt. Der zuvor falsche verschachtelte `miIO.miotspecv2`-RPC-Umschlag war die Ursache des bisherigen Scheiterns.
- Handshake-Wiederverwendung für normale RPCs blieb unverändert; für die Raumreinigung wird weiterhin ein frischer Handshake erzwungen.
- Nächster sinnvoller Schritt: Ergebnis der laufenden Reinigung abwarten und anschließend in einer gebündelten Version die erfolgreiche Funktion sowie gegebenenfalls die Statusmeldung/Fehlerbehandlung finalisieren. Keine weiteren Testfahrten nötig, solange der laufende Durchgang normal endet.


## X20+ Status-Text: Ursache gefunden und korrigiert (12.11.2026)

- Bei der Codeanalyse nach dem erfolgreichen Raumreinigungstest wurde der bekannte veraltete `statusText`-Wert untersucht.
- Ursache belegt: Das MIoT-Profil nennt das Statusfeld bereits `vacuumState` (SIID 2 / PIID 1). Die Polling-Verarbeitung aktualisierte den lesbaren Text jedoch nur innerhalb einer Bedingung `key === "status"`. Diese Bedingung konnte mit dem aktuellen Profil nie zutreffen; daher blieb der Text z. B. auf „Ladung abgeschlossen“ stehen, obwohl `vacuumState` längst „Saugen“ meldete.
- Korrektur Commit `8058e08`: Die Textaktualisierung wird jetzt bei `key === "vacuumState"` ausgeführt. Es wird kein zusätzlicher Poll ausgelöst; der Text wird aus derselben ohnehin empfangenen Statusantwort aktualisiert.
- Build/CI für diese Änderung ausstehend.

## X20+ Carpet Boost: weiterhin vor Hardwaretest

- `carpetBoost` ist im Profil derzeit als optional und vorläufig markiert (SIID 4 / PIID 12). Der Code legt Status- und Control-Datenpunkt an und liest den Wert im langsamen optionalen Einstellungs-Poll; Schreibzugriffe laufen über die generische Property-Schreiblogik.
- Es liegt noch kein bestätigter Hardwaretest vor, dass PIID 12 auf der installierten X20+-Firmware tatsächlich Carpet Boost steuert. Nicht blind umschalten, bevor die Reinigungsfahrt beendet ist und die Semantik anhand eines Readbacks bzw. einer belastbaren C102GL-Referenz bestätigt wurde.
- Die Raumreinigung ist jetzt hardwareseitig bestanden; dieser Punkt bleibt separat offen.


## X20+ Carpet Boost – Funktion präzisiert (12.11.2026)

- Nutzer bestätigt: Carpet Boost ist die automatische stärkere Saugleistung auf Teppichen. Die Teppichflächen werden weiterhin ausschließlich in der Xiaomi-Original-App angelegt; der Adapter soll keine Teppichkarten oder Teppichzonen verwalten.
- Die C102GL-Referenzimplementierung führt `carpetBoost` ebenfalls als MIoT-Eigenschaft SIID 4 / PIID 12. Die Zuordnung im Adapter ist damit durch eine zweite modellbezogene Referenz gestützt; der Hardware-Readback bzw. das Umschalten über den Adapter ist noch nicht live bestätigt.
- Sinnvoller nächster Test nach Ende der laufenden Reinigung: aktuellen Wert in `status.carpetBoost` mit der Original-App vergleichen und – falls die Funktion dort aktiviert/deaktiviert werden kann – eine einzelne kontrollierte Umschaltung über `control.carpetBoost` mit Readback prüfen. Keine Teppichkonfiguration im Adapter nachbauen.


- Nachtrag nach Screenshot der Xiaomi-Original-App: Die Einstellung ist vorhanden und heißt dort „Teppich-Boost“. Sie befindet sich unter „Einstellungen für die Teppichreinigung“ und ist als eigener Ein/Aus-Schalter sichtbar. Darunter gibt es separat die Teppichreinigungsmethode („Saugen nur auf Teppichen“ / „Teppiche vermeiden“). Damit ist Carpet Boost eindeutig eine eigene Funktion; die vorherige Annahme, es gebe keinen separaten App-Schalter, war falsch.
- Für den Adapter ist `carpetBoost` SIID 4 / PIID 12 damit fachlich plausibel. Nach Abschluss der laufenden Reinigung kann der Datenpunkt `status.carpetBoost` mit dem App-Schalter verglichen und danach `control.carpetBoost` kontrolliert getestet werden. Die Teppichreinigungsmethode ist eine getrennte Einstellung und darf nicht mit Carpet Boost gleichgesetzt werden.


## X20+ Carpet Boost write correction (12.11.2026)

- Hardwarebeobachtung: Änderungen des Teppich-Boost-Schalters in der Original-App werden nach dem langsamen Einstellungs-Poll im Adapterstatus sichtbar. Damit ist der Leseweg grundsätzlich bestätigt.
- Schreibversuch über `control.carpetBoost` wurde vom Roboter mit MIoT `code: -1` abgelehnt. Der Log zeigt SIID 4 / PIID 12.
- Offizielle C102GL-MIoT-Spezifikation beschreibt SIID 4 / PIID 12 als `uint8`, Zugriff `read, notify, write`, Werte `0 = Close`, `1 = Open`. Das ioBroker-Control bleibt benutzerfreundlich boolean, aber der MIoT-Schreibwert muss numerisch 0/1 sein.
- Korrektur Commit `c49a0e9`: Carpet Boost wird beim Schreiben in 0/1 umgewandelt und anschließend einmal gezielt zurückgelesen. Status und Control werden erst anhand des bestätigten Readbacks aktualisiert. Keine zusätzlichen zyklischen Abfragen.
- Hardwaretest und CI für diese Korrektur stehen noch aus. Vor erfolgreichem Build nicht installieren.


## X20+ Zeitpläne – Xiaomi-Home-Synchronisierung (Version 0.1.52, 12.11.2026)

- Nutzerpriorität: Zeitpläne sollen mit der Xiaomi-Original-App synchron bleiben. Zunächst sind Auslesen und Kontrolle wichtig; Bearbeiten ist optional.
- Modellbezogene Referenz für den Xiaomi X20+ / C102GL bestätigt das MIoT-Feld **SIID 8 / PIID 2** als gespeicherte Zeitpläne. Die Rohdaten enthalten mehrere durch Semikolon getrennte Einträge mit ID, Aktivierungsstatus, Uhrzeit, Wochentags-Bitmap (Montag bis Sonntag), Wiederholung, Reinigungsmodus, Saugstufe, Wasserstufe und Raum-IDs.
- Neu in 0.1.52: `x20Plus.control.refreshSchedules` liest diesen Wert auf ausdrücklichen Abruf über die bereits angemeldete Xiaomi-Cloud-Sitzung. Die Sitzung wird bei Bedarf wie bei den bestehenden Cloud-Funktionen gespeichert.
- Neue read-only Datenpunkte: `x20Plus.timing.raw`, `parsed`, `summary`, `status` und `lastUpdate`. Raum-IDs werden, sofern eine importierte Raumkarte vorhanden ist, in Raumnamen aufgelöst.
- Bewusste Lastbegrenzung: keine zusätzliche zyklische Abfrage und keine Schreibzugriffe auf Zeitpläne. Ein Abruf erfolgt nur, wenn der Nutzer `refreshSchedules` auslöst. Damit bleibt die Xiaomi-App die führende Stelle; Änderungen in der App werden beim nächsten Abruf sichtbar.
- Bearbeiten/Aktivieren/Löschen über ioBroker bleibt offen. Die untersuchte C102GL-Referenz kann Zeitpläne lesen, dokumentiert aber keine unterstützte Schreibschnittstelle. Keine undokumentierten Schreibversuche, die App-Zeitpläne beschädigen oder auseinanderlaufen lassen könnten.
- Parser-Regressionstests ergänzt für Wochentage, Aktivierung, mehrere Einträge, Raumauflösung und fehlerhafte Einträge.
- **Build/CI erfolgreich:** beide GitHub-Actions-Läufe für Commit `479b923` liefen erfolgreich durch. `npm ci`, `npm run build`, `npm test`, `npm run lint` und Paketprüfung waren erfolgreich. Die Änderung ist damit buildbar; Hardware-Readback über den X20+ steht noch aus. Vor breiter Nutzung zuerst einmal `refreshSchedules` auslösen und die Ausgabe mit der Xiaomi-App vergleichen.

## X20+ Zeitpläne – automatische 30-Minuten-Synchronisierung (Version 0.1.53)

- Nutzer hat die automatische Aktualisierung im Abstand von 30 Minuten ausdrücklich bestätigt.
- `x20Plus.control.refreshSchedules` bleibt zusätzlich als manueller Abruf erhalten. Damit kann nach Änderungen in Xiaomi Home jederzeit sofort synchronisiert werden.
- Automatische Aktualisierung liest ausschließlich SIID 8 / PIID 2 über die vorhandene Xiaomi-Cloud-Sitzung. Keine MIoT-Abfrage an den Roboter, kein zusätzlicher lokaler Poll und keine Schreibzugriffe auf Zeitpläne.
- Läuft gerade ein anderer Xiaomi-Cloud-Befehl, wird die automatische Synchronisierung um eine Minute verschoben, statt parallel zu starten. Fehlt die Cloud-Sitzung, wird der Abruf übersprungen und der Status entsprechend gesetzt.
- Timer wird beim Adapter-Unload beendet. Adapterversion auf **0.1.53** angehoben.
- CI/Build und Hardware-Readback für den automatischen Ablauf stehen noch aus. Die manuelle Lesefunktion aus 0.1.52 ist weiterhin die Grundlage und muss am Gerät zuerst verifiziert werden.


## X20+ Zeitplan-Parser korrigiert nach Live-Vergleich mit Xiaomi Home (12.11.2026)

- Der erste Hardware-Readback aus Version 0.1.53 lieferte drei echte Zeitpläne. Der direkte Vergleich mit der Xiaomi-Original-App zeigte fehlerhafte Anzeigen für Wochentage, Reinigungsart und Bereich.
- Parserkorrektur für die C102GL-Bitmap: Das Feld wird als Bitmaske mit umgekehrter Textreihenfolge dekodiert (linkes Bit = Samstag, rechtes Bit = Sonntag). Der beobachtete Wert `0111110` ergibt damit Montag bis Freitag; `1000001` ergibt Samstag und Sonntag.
- Reinigungsmodus `1` wird als „Saugen und Wischen“ interpretiert; Modus `2` als „Nur Wischen“. Das entspricht dem Live-Vergleich der Einträge mit der Xiaomi-App und weicht von der bisher verwendeten Drittanbieter-Zuordnung ab.
- Raumliste `0` wird als Marker „Alle Bereiche“ statt als Raum-ID 0 angezeigt.
- Regressionstest mit den beobachteten X20+-Beispieldaten ergänzt. Die Zeitpläne bleiben read-only; keine Schreibzugriffe und keine zusätzlichen Geräteabfragen.
- Adapterversion auf **0.1.54** angehoben. CI/Build für diese Parserkorrektur noch ausstehend; erst nach erfolgreicher CI installieren und anschließend denselben Vergleich erneut durchführen.

- CI-Fehleranalyse: Build war erfolgreich, ein neuer Regressionstest schlug fehl, weil dessen Test-Rohstrings versehentlich ein Feld (Saugstufe) ausgelassen hatten. Das war ein fehlerhafter Test-Fixture, kein TypeScript-/Buildfehler. Testdaten korrigiert in Commit `7e1196b`; neuer CI-Lauf wird geprüft.


## Korrektur der Funktionstest-Matrix: Teppich-Boost und Stop (12.11.2026)

- **Teppich-Boost: BESTANDEN.** Nach der Korrektur des Schreibwerts auf MIoT-`uint8` (0/1) wurde das Schalten über `control.carpetBoost` nach Installation erfolgreich getestet und vom Nutzer bestätigt. Der gezielte Readback bleibt Bestandteil des Schreibpfads; kein zusätzlicher zyklischer Poll.
- **Stop-Funktion: ABGESCHLOSSEN.** Der Live-Test war bereits durchgeführt: `control.stop` löste dasselbe Pausenverhalten wie `control.pause` aus (beide SIID 2 / AIID 2). Deshalb wurde der separate X20+-Datenpunkt in Version 0.1.51 entfernt. Stoppen ist damit kein offener Test und wird nicht erneut eingeplant.
- Beide Funktionen aus der offenen Testliste entfernen und nicht erneut testen, sofern kein neuer Fehler auftritt.

## X20+ Zeitpläne dauerhaft aktivieren/deaktivieren (Version 0.1.55, 12.11.2026)

- Die aktuelle MIoT-Spezifikation für das exakte Modell **xiaomi.vacuum.c102gl (Xiaomi Robot Vacuum X20+)** bestätigt den Zeitplan-Dienst SIID 8: `timer-clean` (PIID 2) ist als **R / N / W** ausgewiesen. Die bisherige Annahme „Zeitpläne nur lesbar“ war damit zu konservativ.
- Die Spezifikation führt außerdem `delete-timer` (SIID 8 / AIID 1) mit Timer-ID als Eingabe auf. Löschen wird für diesen Umfang ausdrücklich nicht implementiert.
- Neuer Adapterbefehl `x20Plus.control.setScheduleEnabled` nimmt JSON `{ id, enabled }` entgegen. Der Adapter liest vor jedem Schreibvorgang den aktuellen Zeitplan frisch aus der bestehenden Xiaomi-Cloud-Sitzung, ändert ausschließlich das Aktivierungsfeld des ausgewählten Eintrags, schreibt den vollständigen Zeitplanwert über `/v2/miotspec/prop/set` zurück und liest ihn unmittelbar erneut aus.
- Der Adapter aktualisiert `timing.raw`, `timing.parsed`, `timing.summary` und `timing.lastUpdate` ausschließlich nach erfolgreichem, inhaltlich identischem Readback. Keine zusätzlichen zyklischen Polls; nur drei Cloud-MIoT-Aufrufe bei einer expliziten Benutzeraktion (aktuellen Stand lesen, schreiben, Readback).
- Das Aktivierungsfeld wird gemäß dem bereits verwendeten Parser zwischen `0` (deaktiviert) und `3` (aktiviert) umgeschaltet. Alle anderen Felder und alle übrigen Zeitpläne bleiben unverändert. Unbekannte IDs und fehlerhafte Einträge werden vor dem Schreibzugriff abgewiesen.
- **Noch nicht hardwarevalidiert:** Die MIoT-Spezifikation belegt die Schreibberechtigung, aber der konkrete Cloud-Schreibpfad und das Aktivierungsflag müssen nach erfolgreichem CI am realen X20+ mit genau einem vorhandenen Testzeitplan verifiziert werden. Vor diesem Test keine produktive Änderung über den neuen Schalter vornehmen.


- Nachkontrolle der 0.1.55-Implementierung: Die aktualisierte Anzeige nach dem Schreib-Readback löst Raumnamen erneut aus der bereits importierten Raumkarte auf. Der Schreib-Lock wird nur freigegeben, wenn dieser Handler ihn tatsächlich erworben hat; ein abgewiesener Parallelbefehl kann so keinen bereits laufenden Cloud-Auftrag entsperren.

## X20+ Zeitplan-Schalter: Readback-Prüfung robuster gemacht (12.11.2026)

- Live-Test mit Adapter 0.1.55: Xiaomi nahm die MIoT-Schreibanfrage an, aber der anschließende Readback stimmte nicht bytegenau mit dem gesendeten String überein. Der bisherige Fehlertext ließ offen, ob Xiaomi den Aktivierungswert nicht gespeichert oder nur die String-Serialisierung normalisiert hatte.
- Ursache der bisherigen Fehlermeldung im Code bestätigt: Es wurde der komplette rohe Zeitplan-String Zeichen für Zeichen verglichen. Das ist unnötig streng und kann harmlose Format-/Whitespace-Normalisierungen als Fehler einstufen.
- Korrektur in 0.1.56: Readback wird jetzt strukturell geprüft. Der ausgewählte Zeitplan muss den gewünschten Aktivierungswert (0/3) enthalten; alle übrigen Felder und alle anderen Zeitpläne müssen unverändert bleiben. Reihenfolge und Anzahl der Zeitpläne werden ebenfalls geprüft. Eine tatsächlich nicht gespeicherte Aktivierung bleibt ein Fehler.
- Regressionstests decken harmlose Whitespace-Normalisierung, nicht gespeicherte Aktivierung und unerlaubte Änderungen an anderen Feldern ab.
- Keine zusätzlichen Polls oder Cloud-Aufrufe: weiterhin genau ein Lesen vor dem Schreiben, ein Schreibaufruf und ein Readback pro ausdrücklicher Schalteraktion.
- CI und Hardware-Nachtest stehen noch aus. Der tatsächliche Cloud-Schreibpfad gilt weiterhin nicht als hardwarevalidiert.

## X20+ Zeitplan-Schalter: Aktivierungsflag korrigiert (12.11.2026)

- Kritischer Fehler in 0.1.56 gefunden: Der Adapter behandelte `3` als Aktivierungswert. Reale X20+-MIoT-Datensätze aus Community-Logs belegen dagegen `1` = aktiviert und `0` = deaktiviert (z. B. `time:timer-clean = 1-1-09:00-0111110-1-0-3-0-0`).
- 0.1.57 korrigiert Parser, Setter und Readback-Prüfung auf `1`/`0`. Frühere 0.1.56-Annahme `3` war falsch; das kann erklären, warum Xiaomi den Eintrag nach dem Schreibversuch als ungültig anzeigte.
- Der Adapter darf bis zu einem erneuten kontrollierten Hardwaretest nicht zum Ändern von Zeitplänen verwendet werden. Keine weiteren Schreibversuche durchgeführt.
- CI und Hardware-Nachtest für 0.1.57 stehen noch aus. Nutzerhinweis: den eventuell ungültigen 09:00-Eintrag zunächst in Xiaomi Home prüfen/reparieren; nicht blind erneut schreiben.
- Recherche: offizielle MIoT-Spezifikation bestätigt `time` SIID 8 / `timer-clean` PIID 2 als R/N/W; Community-Logs liefern echte Beispielwerte mit `1` als aktivem Flag.


## X20+ Zeitplan-Aktualisierung: Server-Cache gegen Roboter vergleichen (12.11.2026)

- Ursache für veraltete Zeitpläne eingegrenzt: MIoT `datasource: 1` liest bevorzugt den Xiaomi-Servercache und garantiert keine aktuellen Werte. `datasource: 2` löst einen direkten RPC zum Gerät aus und liefert dessen aktuellen Wert.
- Manuelle Aktualisierung liest nun beide Quellen nacheinander, vergleicht sie im Adapterlog und verwendet ausschließlich `datasource: 2` für `timing.raw`, `timing.parsed` und HomePilot. Schlägt der direkte Geräteabruf fehl, wird ausdrücklich kein Cache-Fallback angezeigt.
- Die zusätzliche direkte Geräteabfrage erfolgt ausschließlich bei bewusstem manuellem Aktualisieren, nicht zyklisch und nicht beim normalen Polling.
- Quelle zur Bedeutung von datasource 1/2: offizielle Xiaomi IoT-Dokumentation und MIoT Plugin SDK; datasource 1 bevorzugt Cache, datasource 2 erzwingt RPC zum Gerät.
- Noch ausstehend: CI und Hardwaretest der Aktualisierung. Zeitplan-Schreibfunktion bleibt bis zur separaten Verifikation unangetastet.


## X20+ Zeitplananzeige: automatische Wasseranpassung (12.11.2026)

- Hardware-/App-Abgleich nach Adapter 0.1.58: Zeitplananzahl, Uhrzeiten und Wochentage stimmen mit Xiaomi Home überein; Servercache und direkter Roboterabruf melden identische Werte.
- Ein verbleibender Darstellungsunterschied: Xiaomi Home zeigt beim neuen Einmal-Zeitplan „Automatische Anpassung“, HomePilot zeigte für den Rohwert 0 „Unbekannt (0)“.
- Parser-Mapping für Wasser-/Wischanpassungswert 0 ergänzt: „Automatische Anpassung“. Regressionstest ergänzt.
- Keine Änderung am Schreibpfad und keine zusätzliche Roboter-/Cloud-Abfrage.
- Adapterversion 0.1.59; CI und Build ausstehend.


## X20+ Zeitplan-Schalter: Readback ebenfalls direkt vom Roboter (12.11.2026)

- Hardwaretest mit 0.1.59 zeigt: Das Ausschalten wird in Xiaomi Home übernommen, HomePilot meldet aber weiterhin „schedule #4 is still active“.
- Ursache im Code eingegrenzt: Der Schreibhandler las sowohl den Ausgangswert als auch den Readback weiterhin mit dem Standard `datasource: 1` (Xiaomi-Servercache). Die manuelle Aktualisierung verwendet dagegen bereits `datasource: 2` (direkter Geräteabruf). Damit konnte die Readback-Prüfung trotz erfolgreicher Änderung einen veralteten Cachewert prüfen.
- Korrektur in 0.1.60: Vorher-Lesen und Readback des Schreibhandlers explizit auf datasource 2 umgestellt. Der Schreibaufruf selbst bleibt unverändert. Nach erfolgreichem Readback werden die bereits bestätigten aktuellen Daten in die ioBroker-States übernommen.
- Zwei zusätzliche Info-Logmeldungen kennzeichnen Quelle von Ausgangswert und Readback.
- Keine zusätzlichen Cloud-Aufrufe: weiterhin drei MIoT-Aufrufe pro Schaltvorgang (direkt lesen, schreiben, direkt zurücklesen). Keine zyklischen Abfragen.
- CI und erneuter Hardwaretest ausstehend. Vor CI-Erfolg nicht installieren.


## Aktueller Hardware-Status: X20+ Zeitplan-Schalter erfolgreich bestätigt (12.11.2026)

- Nutzerbestätigung am realen Xiaomi Robot Vacuum X20+: In HomePilot lassen sich gespeicherte Zeitpläne jetzt sowohl **aktivieren als auch deaktivieren**; beide Richtungen werden korrekt in Xiaomi Home übernommen und HomePilot zeigt den bestätigten Zustand ohne den vorherigen Readback-Fehler.
- Verifizierte Basis: Adapter **0.1.60**, Commit `679d6fad6fd4d1f3ffe78f9120299933f8ec9286`. CI (build-and-test und test-build) war erfolgreich; der anschließende Hardwaretest ist ebenfalls erfolgreich.
- Der entscheidende Fix: Ausgangswert und Readback beim Schalten werden explizit mit MIoT `datasource: 2` direkt vom Roboter gelesen. Der Servercache (`datasource: 1`) wird nicht mehr für die Schreib-Rückkontrolle verwendet. Pro ausdrücklichem Schaltvorgang bleiben es drei MIoT-Aufrufe: direkt lesen, schreiben, direkt zurücklesen. Keine zusätzlichen Hintergrundabfragen.
- Manuelle Aktualisierung liest Cache und Gerät zum Vergleich und verwendet für die Anzeige den direkten Gerätewert. Der Nutzer hat bestätigt, dass die Zeitplanliste danach mit Xiaomi Home übereinstimmt.
- Parser-Anzeige für Wasserwert `0` als „Automatische Anpassung“ ergänzt (0.1.59); Zeitplananzahl, Uhrzeiten und Wochentage wurden im Hardwarevergleich abgeglichen.
- **Schreibfunktion Aktivieren/Deaktivieren: hardwarevalidiert.** Sonstige Zeitplanfelder (Uhrzeit, Wochentage, Reinigungsmodus, Saugstufe, Wasserstufe, Räume) sind weiterhin nicht als editierbare Schreiboperationen implementiert oder hardwarevalidiert.
- Einschätzung für spätere Bearbeitung: Das MIoT-Property `time:timer-clean` (SIID 8 / PIID 2) ist als Ganzes les-/schreibbar und der Adapter kennt ein neun-teiliges Datensatzformat. Daraus lässt sich die grundsätzliche Struktur der Felder ableiten. Das beweist aber noch nicht alle Wertebereiche, Sonderfälle (Einmal-/Wiederholungspläne, Räume/Segmente, automatische Wasseranpassung) oder Xiaomis Validierungsregeln. Eine komplette Bearbeitungsoberfläche wäre daher derzeit verfrüht.
- Empfehlung: Aktivieren/Deaktivieren stabil belassen. Falls später Bearbeitung gewünscht ist, zuerst eine eng begrenzte Änderung (z. B. nur Uhrzeit eines bestehenden Plans) mit strikter Validierung, direktem Readback und kontrolliertem Einzeltest entwickeln. Keine Änderung an bestehenden Zeitplänen ohne Sicherung des vollständigen Originalstrings.
- Dieser Abschnitt ist der maßgebliche aktuelle Hardwarestatus und ersetzt ältere „noch nicht hardwarevalidiert“-/„Hardwaretest ausstehend“-Hinweise in den vorherigen Entwicklungsabschnitten.


## X20+ Zeitpläne bearbeiten – Adapterbasis 0.1.62 (12.11.2026)
- Neue Aktion `x20Plus.control.updateSchedule` bearbeitet ausschließlich einen bestehenden Zeitplan (keine Neuanlage/Löschung).
- Fehlerursache des ersten Speicherversuchs: State-Objekt fehlte und war nicht abonniert; die App konnte deshalb keinen Handler auslösen. State wird jetzt angelegt und abonniert.
- Felder: Uhrzeit, Wochentage/Einmalig, Reinigungsmodus, Saugleistung, Wasserstufe und Raum-IDs.
- Direktes Lesen vom Roboter, gezielte Änderung, Schreiben und direkter Readback. Andere Zeitpläne und Aktivierungsstatus bleiben unverändert.
- Adapterversion 0.1.62. CI und Hardwaretest stehen noch aus; bis zur grünen CI nicht installieren.


## Xiaomi X20+ Zeitplanbearbeitung – Nachbesserung (12.11.2026)
- Live-Test: Wochentagsänderung wurde von Xiaomi Home übernommen. Der anschließende direkte Readback lief jedoch in einen Timeout; die vorherige Statusmeldung stellte dadurch eine bereits angenommene Änderung fälschlich als fehlgeschlagen dar.
- Schreibpfad angepasst: Nach erfolgreicher MIoT-Schreibantwort werden die angeforderten Zeitpläne sofort in ioBroker aktualisiert und als „von Xiaomi angenommen“ gemeldet. Der direkte Readback läuft anschließend separat. Ein Readback-Timeout wird als ausstehende Bestätigung gemeldet, nicht als fehlgeschlagener Schreibvorgang.
- Doppelte Anlage/Subscription von `x20Plus.control.updateSchedule` entfernt.
- Reinigungsmodus-Codierung auf fünf Xiaomi-Home-Optionen erweitert: 0 automatische Anpassung, 1 nur Saugen, 2 Saugen und Wischen, 3 nur Wischen, 4 Saugen vor Wischen. Validierung und Tests entsprechend erweitert.
- Adapterversion **0.1.62**. CI für den aktuellen Commit steht noch aus; Hardwaretest der Status-/Readback-Behandlung offen.


## X20+ Zeitplan-Rohdaten vom Nutzer – Bitmap-Korrektur (12.11.2026)
- Nutzer lieferte den aktuellen Rohwert: `2-0-10:00-1001011-1-4-1-96-0;3-0-12:09-0000000-0-1-1-32-0;4-0-13:11-0000000-0-1-1-64-0`.
- Xiaomi Home zeigt für den ersten Datensatz So, Mi, Fr, Sa. Daraus folgt eindeutig: Bitmap `1001011` ist von links nach rechts Sonntag bis Montag codiert. Parser und Encoder waren spiegelverkehrt/inkonsistent.
- Parser und Schreibfunktion auf `position -> weekday 6-position` korrigiert; Regressionstest mit dem echten Nutzer-Rohwert ergänzt.
- Modus-Codierung bleibt ungeklärt: Rohwert enthält für den ersten Plan Moduswert 4, Xiaomi Home zeigt dafür `undefined`. Die beiden anderen Rohdatensätze tragen jeweils Moduswert 1, werden in Xiaomi Home aber mit unterschiedlichen Reinigungsarten dargestellt. Deshalb keine weitere geratenen Modus-Zuordnung; Rohdatenformat muss weiter untersucht werden.
- Commits: `763eb92c254d034f66b5b923a80200da5b1a8326` (Parser/Encoder), `0c2266d4e209bc07503919a2e254c59505ad90ad` (Tests). CI noch ausstehend; nicht installieren, bis Tests/Build grün sind.


## X20+ Zeitplanfeld-Zuordnung – anhand Xiaomi-Home-Rohdaten (12.11.2026)
- Rohdatenbeispiele des Nutzers: `2-0-10:00-1001011-1-1-1-64-0;3-0-12:09-0000000-0-1-1-48-0;4-0-13:11-0000000-0-1-1-16-0`.
- Feld 5 ist Wasserstufe (0 automatisch, 1 niedrig, 2 mittel, 3 hoch), Feld 6 Saugleistung, Feld 7 Reinigungsart. Verifizierte Werte: 16 Saugen, 32 Saugen und Wischen, 48 Wischen, 64 Saugen vor Wischen. Unbekannte Werte bleiben explizit unbekannt.
- Wochentagsbitmap `1001011` ist laut Xiaomi Home So, Mi, Fr, Sa. Bitmap-Positionen laufen So, Mo, Di, Mi, Do, Fr, Sa; Parser und Encoder entsprechend ausgerichtet.
- Parser, Schreibfunktion und Tests aktualisiert. Adapterversion **0.1.63**. Hardwaretest der Feldzuordnung noch offen.


## X20+ Zeitplanbearbeitung – Hardwaretest bestätigt (12.11.2026)
- Nutzer bestätigt nach Installation von Adapter 0.1.63 und HomePilot 1.29.120: Die Synchronisation der Zeitpläne funktioniert jetzt in beide Richtungen.
- Die korrigierte Feldzuordnung für Reinigungsart, Wasserstufe und Wochentage ist damit nicht nur durch CI-Tests, sondern auch im Zusammenspiel mit dem echten Xiaomi X20+ bestätigt.
- Aktivieren/Deaktivieren bestehender Zeitpläne bleibt unverändert. Keine Neuanlage oder Löschung Bestandteil dieser Funktion.
- Nächster sinnvoller Schritt: weitere Beobachtung im Alltag; keine zusätzliche Abfragefrequenz oder zyklische Roboterbelastung hinzufügen.


## Nächster Entwicklungsschritt: Zeitplanbearbeitung für Roidmi Eve Plus (12.11.2026)
- Als nächstes soll die am echten Xiaomi X20+ erfolgreich getestete bidirektionale Zeitplanbearbeitung auf den **Roidmi Eve Plus** übertragen werden.
- Vor Implementierung zuerst das Eve-Plus-Zeitplanformat, vorhandene MIoT-Properties/Actions und den bestehenden Adapter-Schreib-/Readback-Pfad untersuchen. Keine X20+-Codierungen oder Feldpositionen ungeprüft übernehmen: Eve Plus ist ein separates Gerät.
- Ziel: bestehende Zeitpläne bearbeiten und Änderungen zuverlässig zurücklesen/verifizieren; zunächst keine Neuanlage oder Löschung, sofern nicht später ausdrücklich gewünscht.
- X20+-Implementierung und deren getestete Aktivieren/Deaktivieren-Funktion unverändert lassen. Keine unnötigen zyklischen Abfragen; manuelle Bearbeitung soll die Roboter-/ioBroker-Last gering halten.
- HomePilot anschließend um eine gerätespezifische Eve-Plus-Bedienung ergänzen, falls der Eve-Plus-Datenpfad dies unterstützt.
- Noch nicht begonnen; zunächst Bestandsaufnahme und Protokoll-/Datenformatanalyse.
