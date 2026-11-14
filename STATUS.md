# Roidmi Adapter – aktueller Status

Stand: 2026-11-14, 02:57 MEZ

## Geprüfter Main-Branch-Stand
- Paketversion auf `main`: **0.1.36**. Letzter Build-/Distribution-Commit: `99d88d14421011e7449eba4cb0ac2672f6aada7c`; „Build distribution“ Run `43378078837`: **completed / success**.
- Der zugrunde liegende Quellstand `65c1769b9d1b05da54ee2cdb7276b30af8e2982e` wurde mit CI Run `43378028113` und „Test and build adapter“ Run `43378028172` erfolgreich geprüft.
- Der aktuelle Xiaomi-X20+-Entwicklungsstand liegt getrennt auf `feature/xiaomi-x20plus`: Paketversion **0.1.67**, letzter Code-Commit `68d3508ecb079bf81e31da5941a9f970fce69b89`, Actions #341 / Run `43449224003`: **completed / success**.
- Die Feature-Branch-Statusdateien wurden danach dokumentarisch aktualisiert; es erfolgte keine Übernahme nach `main`.
- `main` und `feature/xiaomi-x20plus` bleiben getrennte Entwicklungsstände; nicht vermischen.

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
