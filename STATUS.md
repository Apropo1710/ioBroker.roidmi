# Roidmi Adapter – aktueller Status

Stand: 2026-11-13, 10:xx MEZ

## Geprüfter Main-Branch-Stand
- Branch: `main`; zuletzt geprüfter Laufzeitcode-Commit `99d88d14421011e7449eba4cb0ac2672f6aada7c`.
- Adapter-Version laut `package.json`: **0.1.36**.
- Workflow „Build distribution“ Run `43378078837`: **completed / success** für exakt diesen Head.
- Der aktive Xiaomi-X20+-Entwicklungsstand liegt separat auf `feature/xiaomi-x20plus`, Version **0.1.66**, CI-/Build #320 erfolgreich. Die beiden Branches dürfen nicht vermischt werden.


Stand: 2026-11-13

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
