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
| Globalen Reinigungsstart aus ioBroker | OFFEN | Noch kein dokumentierter Live-Test |
| Raumkartenimport | BESTANDEN | Neustartlog meldet erfolgreich geladene Karte mit 5 Räumen |
| Raum-ID-Zuordnung und gezielte Raumreinigung | OFFEN | Noch kein dokumentierter Live-Test |
| Teppich-Boost | OFFEN | Noch kein dokumentierter Live-Test |
| Pause / Fortsetzen / Stop | OFFEN | Noch kein dokumentierter Live-Test |
| Rückkehr zur Ladestation | OFFEN | Noch kein dokumentierter Live-Test |

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
