# Roidmi Adapter – aktueller Status

## Verifizierter Abgleich – 18.11.2026, 03:09 MEZ

- `main`: aktueller Head `13566589bcd87af6df1941e5da37bb9641c88377`, Paketversion **0.1.36**. Laufzeit-/Distributionsstand `99d88d14421011e7449eba4cb0ac2672f6aada7c`; „Build distribution“ Run `43378078837` erfolgreich. Die zusätzliche CI-/Distribution-Verifikation auf dem nachfolgenden Statuscommit `70d8c24675ab` (Runs `43405701267`, `43405701410`, `43405771429`) war ebenfalls **completed / success**.
- `feature/xiaomi-x20plus`: aktueller Head `4b77bb304955d085ecedd9d9f76a79b97ed99c39` (Dokumentation), Paketversion **0.1.68**. Letzte Laufzeitcode-Änderungen: `b6d71d0b3d6f` (wiederhergestellte MIoT-Timeouts nur Debug) und `53a60f238703` (doppelte Retry-Warnungen unterdrücken). Run #364 / `43807220218` für den Codebaum vor den reinen Dokumentationscommits: **completed / success**.
- Der Feature-Branch liegt gegenüber `main` **365 Commits voraus / 12 zurück**. [PR #3](https://github.com/Apropo1710/ioBroker.roidmi/pull/3) bleibt offen, Draft und **mergeable: false / dirty**. Keine Übernahme nach `main`.
- [PR #4 – Statusdokumentation](https://github.com/Apropo1710/ioBroker.roidmi/pull/4) bleibt offen und **mergeable: true / clean**. Diese Aktualisierung erfolgt auf dem bestehenden PR-Branch `docs/status-refresh-2026-11-15`; kein zweiter Dokumentations-PR.
- Hardware: Drei Räume in Reinigungsmodus 3 wurden am 15.11. erfolgreich nacheinander erst gesaugt und anschließend gewischt. „Saugen und Wischen gleichzeitig“ sowie weitere Raum-/Moduskombinationen sind nicht als abgeschlossen bestätigt.
- Die leisere MIoT-Fehlerprotokollierung ist CI-geprüft; ein erneuter Live-Test am X20+ nach diesen Logänderungen ist nicht belegt.
- `main` und `feature/xiaomi-x20plus` bleiben getrennte Entwicklungsstände. Keine automatische Übernahme, Zusammenführung oder Branchlöschung.


## Historischer Detailstand – 13.11.2026

## Aktuelle Version
- Adapter-Version: 0.1.36
- Hauptbranch: `main`
- Zielgerät: Roidmi EVE Plus

## Zuletzt umgesetzt
- Optionale automatische Aktualisierung gespeicherter Reinigungszeitpläne ergänzt.
- In der Adapterkonfiguration kann der automatische Abruf ein- und ausgeschaltet werden.
- Abrufintervall in Minuten konfigurierbar (5 bis 1440 Minuten, Standard 60).
- Automatischer Abruf ist standardmäßig deaktiviert.
- Zeitplanabfrage bleibt von der häufigen Statusabfrage getrennt und verwendet eine einzelne MIoT-`get_properties`-Anfrage.
- Bei gleichzeitig laufendem Roboterbefehl oder Statusabruf wird ein automatischer Zeitplanabruf übersprungen; es wird keine zusätzliche Warteschlange aufgebaut.
- Manuelles Auslösen über `control.refreshTiming` bleibt erhalten.

## Belastungsprinzip
Statuswerte werden weiterhin gebündelt und mit dem konfigurierten Statusintervall abgefragt. Zeitpläne werden nur manuell oder bei ausdrücklich aktivierter Automatik in einem deutlich längeren Intervall gelesen. Standardmäßig entsteht keine zusätzliche Roboterlast.

## Offene Hardwareprüfung
- Das Verhalten der optionalen automatischen Zeitplanaktualisierung und des konfigurierbaren Intervalls am realen EVE Plus noch praktisch prüfen. Die Automatik bleibt standardmäßig deaktiviert; keine zusätzliche Roboterlast ohne ausdrückliche Aktivierung.
- Der frühere CI-Pending-Punkt für Version 0.1.36 ist erledigt: CI, Adapter-Build und Distribution sind für die oben genannten Commits erfolgreich.
