# Roidmi Adapter – aktueller Status

## Verifizierter Abgleich – 16.11.2026, 03:03 MEZ

- `main`: Head `13566589bcd87af6df1941e5da37bb9641c88377`, Paketversion **0.1.36**; Distribution-Run `43378078837` **completed / success**.
- `feature/xiaomi-x20plus`: Paketversion **0.1.68**, aktueller Head `a92e4960cd9d13f39d755634edffb3d09cb1faab`. PR #3 bleibt offen und Draft, `mergeable: false`; Vergleich **355 ahead / 12 behind**. Der getestete Baum mit dem konstanten fünften `selects`-Wert `1` und Drei-Raum-Regressionstest wurde in Run #359 / `43743505173` erfolgreich geprüft. Der zugehörige Commit `4bf65cb16967c7171deb2b9ce2607b740a675b63` war selbst dokumentationsbezogen; die exakte SHA des vorangegangenen Code-Commits ist nicht eindeutig ermittelt.
- Hardware: Drei Räume in Modus 3 am 15.11. erfolgreich (erst Saugen, dann Wischen). „Saugen und Wischen gleichzeitig“ ist für den 16.11. geplant und noch offen.
- PR #4 (diese Statusdokumentation) bleibt offen und mergeable. Keine Übernahme nach `main`; HomePilot muss für den Adapter-Payload-Fix nicht geändert werden.


Stand: 2026-11-15, 03:05 MEZ

## Geprüfter Main- und Feature-Branch-Stand – 15.11.2026, 03:01 MEZ
- `main`: aktueller Branch-Head `13566589bcd87af6df1941e5da37bb9641c88377` (Dokumentationscommit); Paketversion **0.1.36**. Letzter Code-/Distribution-Commit `99d88d14421011e7449eba4cb0ac2672f6aada7c`; „Build distribution“ Run `43378078837`: **completed / success**.
- Aktiver X20+-Entwicklungsbranch `feature/xiaomi-x20plus`: aktueller Head `67ca357bfc69cd8266a5e76628fc99fd351bfaca` (Dokumentation); letzter Code-Head `68d3508ecb079bf81e31da5941a9f970fce69b89`, Paketversion **0.1.67**. Der Build für den Code-Head (Run `43449224003`) und der aktuelle Branch-Head-Lauf (Run `43630366470`) waren erfolgreich.
- Pull Request [#3](https://github.com/Apropo1710/ioBroker.roidmi/pull/3) ist offen und Draft. Der Feature-Branch liegt 340 Commits vor und 12 hinter `main`; GitHub meldet derzeit `mergeable: false`. Keine Übernahme nach `main`, bis der Branchvergleich und die Konfliktlage bewusst geprüft wurden.
- Die Mehrraumreinigung im Modus 3 wurde für die Auswahl zweier Räume in Xiaomi Home untersucht. Bestätigt ist die Auswahl beider Räume mit dem fünften `selects`-Wert `1`; der vollständige Reinigungslauf, drei oder mehr Räume und weitere Kombinationen sind noch nicht vollständig bestätigt.
- `main` und `feature/xiaomi-x20plus` bleiben getrennte Entwicklungsstände; keine Versions- oder Codeübernahme durch diese Statuspflege.


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
