# Roidmi Adapter – aktueller Status

## Verifizierter Abgleich – 17.11.2026, 02:56 MEZ

- `main`: Head `13566589bcd87af6df1941e5da37bb9641c88377`, Paketversion **0.1.36**. Der letzte Distribution-Commit `99d88d14421011e7449eba4cb0ac2672f6aada7c` wurde mit Run `43378078837` **completed / success** gebaut.
- `feature/xiaomi-x20plus`: Paketversion **0.1.68**. Letzte Laufzeitcode-Änderungen `b6d71d0b3d6f` und `53a60f238703`; die nachfolgenden Status-/Übergabecommits sind reine Dokumentation. Run #363 / `43807209222` und #364 / `43807220218`: **completed / success**.
- Der Feature-Branch liegt gegenüber `main` **361 Commits voraus / 12 zurück**. PR [#3](https://github.com/Apropo1710/ioBroker.roidmi/pull/3) bleibt offen, Draft und **mergeable: false / dirty**; Feature-PR-Head nach den Status- und Übergabeaktualisierungen `4b77bb304955`. Keine Übernahme nach `main`.
- Hardware: Drei Räume in Modus 3 wurden am 15.11. erfolgreich erst gesaugt und anschließend gewischt. „Saugen und Wischen gleichzeitig“ ist nicht als abgeschlossen bestätigt; weitere Raum-/Moduskombinationen bleiben offen.
- Die MIoT-Logkorrekturen (wiederhergestellte Timeouts auf Debug-Level, doppelte Retry-Warnungen unterdrückt) sind CI-geprüft; ein erneuter Live-Test nach diesen Änderungen ist nicht dokumentiert.
- PR [#4 – Statusdokumentation](https://github.com/Apropo1710/ioBroker.roidmi/pull/4) ist offen und mergeable/clean. Diese Aktualisierung wird auf seinem vorhandenen Head-Branch `docs/status-refresh-2026-11-15` fortgeführt; kein zweiter Dokumentations-PR wird angelegt.

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
