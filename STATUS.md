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
