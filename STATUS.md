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
