# Projektstatus – ioBroker.roidmi

Zuletzt aktualisiert: 11.11.2026 (12:15 MEZ)  
Aktiver Entwicklungsbranch: `feature/xiaomi-x20plus`  
Repository: https://github.com/Apropo1710/ioBroker.roidmi  
Draft-PR: https://github.com/Apropo1710/ioBroker.roidmi/pull/3 (nicht mergen)

> Diese Datei ist die zentrale Übergabe für neue Chats. Vor jeder weiteren Änderung zuerst diese Datei lesen und sie im selben Arbeitsgang wie die Codeänderung aktualisieren.

## Aktueller Stand

- Neuester Code-Commit: `e464a4fbf3768d76db32cb87944c66cdb8399bf0`\n- Letzter Dokumentations-Commit: `b7616462cffa56d37352f6649c2029aef9ac57a8` (STATUS.md angelegt)
- Commit-Nachricht: `Create Xiaomi mop diagnostic state during adapter startup`
- GitHub Actions für genau diesen Commit:
  - CI #374: erfolgreich
  - Test and build adapter #146: erfolgreich
- Die tatsächliche Adapterversion steht in `package.json` / `io-package.json`, nicht im Namen des GitHub-Artefakts. Vor Weitergabe eines ZIP immer die Paketversion prüfen.
- Für `e464a4f` wurde das Build-Artefakt `iobroker-roidmi-0.1.35` abgerufen und dessen Inhalt geprüft: `package.json` meldet Adapterversion **0.1.48**. Artefaktnamen sind nicht als Versionsquelle geeignet.

## Verifizierter Stand des aktuellen Branch-Heads (11.11.2026)

- PR #3 zeigt auf `b50e5f34d654b775212a0b4e825a85920de5c6f4`; der PR ist weiterhin offen und Draft, nicht gemergt.
- Für exakt diesen Head sind CI #377 (`build-and-test`) und Test and build adapter #149 (`test-build`) erfolgreich.
- Das zugehörige Artefakt wurde abgerufen: `iobroker-roidmi-0.1.35`. Im enthaltenen Paket melden sowohl `package.json` als auch `io-package.json` die tatsächliche Version **0.1.48**.
- Das entpackte Artefakt wurde lokal mit `node --test` geprüft: **73 Tests bestanden, 0 fehlgeschlagen**.
- Die drei Commits seit `e464a4f` betreffen ausschließlich die `STATUS.md`; es gibt keine neuere Codeänderung.
- Codeprüfung: `onReady()` ruft zuerst `migrateLegacyStateTree()` auf und legt anschließend Kanäle sowie `x20Plus.info.mopModeReadback` an. Die Migration scannt bestehende State-Objekte, mappt nur bekannte Legacy-IDs und löscht nach erfolgreicher Verarbeitung jeweils die alte ID. Sie mappt/löscht den neuen Diagnose-State nicht.
- Der Xiaomi-Poller erstellt den Diagnose-State erneut vor dem Polling und schreibt den Rohwert im bestehenden Poll für SIID 4 / PIID 5. Es wird keine zusätzliche MIoT-Abfrage nur für die Diagnose ausgeführt.
- Die Rohantwort wird nur im Diagnose-State sichtbar, sobald die entsprechende Wasserstufen-Property im normalen Poll verarbeitet wird. Zu prüfen bleiben deshalb nach Installation: Existenz des Objekts und anschließender Rohwert aus dem bestehenden Poll.
- Keine zufälligen weiteren Varianten zur Objekterstellung ergänzen, bevor der Nutzer den aktuellen, geprüften Stand getestet hat.

## Manuelle Xiaomi-Cloud-Gegenprobe für Wasserstufe (11.11.2026)

- Unabhängige C102GL-Referenz `dacrypt/xiao` dokumentiert Wasserstufe `low/medium/high` und Beispiel `High (raw: 3)`; die öffentliche C102GL-MIoT-Spezifikation bestätigt SIID 4 / PIID 5 als Mop Mode mit Werten 1 Low, 2 Medium, 3 High.
- Damit ist die numerische Zuordnung 1=Niedrig, 2=Mittel, 3=Hoch plausibel und unabhängig bestätigt. Die bisherigen erfolgreichen Schreib-/Readback-Logs passen dazu. Der App-Screenshot „Grad 2“ bei lokalem Rohwert 3 beweist daher keine verschobene Enum-Zuordnung; es muss geklärt werden, ob die lokale Antwort veraltet ist oder die App-Einstellung auf einem anderen Kontext/Profil liegt.
- Neuer Diagnoseweg: `x20Plus.control.readMopModeCloud` ist ein manueller Button. Er liest genau SIID 4 / PIID 5 einmalig über Xiaomi Cloud `/v2/miotspec/prop/get` (datasource 1) und speichert die rohe Antwort in `x20Plus.info.mopModeCloudReadback`.
- Diese Cloud-Abfrage ist ausdrücklich nicht Teil des regelmäßigen Pollings. Keine zusätzliche Roboterabfrage; nur eine einzelne manuell ausgelöste Cloud-Leseabfrage.
- Nächster Schritt nach erfolgreichem Build/Installation: App-Wasserstufe auf Grad 2 belassen, normalen lokalen Readback notieren und einmal `control.readMopModeCloud` auslösen. Vergleich:
  - Cloud=2, lokal=3: lokaler MIoT-Readback ist veraltet/abweichend.
  - Cloud=3, lokal=3: Xiaomi Cloud und lokaler Wert stimmen überein; App-Anzeige/Profil-Kontext oder verzögerte App-Synchronisierung untersuchen.
  - Cloud-Fehler: Session/API-Antwort untersuchen, nicht den Roboter-Poller ändern.
- Neue Code-Commits: `007b1cdf26e6b68a86bef477b07240f91c1e2c47` (Cloud-Property-Read), `f259c092bc2c3c3f39ccd30097c3c63c88c93bee` (manueller Diagnose-Button) und `ecb4780050c3b7befb0e69b2e676ee06b374ffe5` (DID-Regex-Korrektur). Verifiziert für Code-Commit `ecb4780050c3b7befb0e69b2e676ee06b374ffe5`: CI #385 erfolgreich; Test and build adapter #157 erfolgreich (npm test, lint, build). Artefakt `iobroker-roidmi-0.1.35` heruntergeladen und kontrolliert; `package.json` und `io-package.json` melden beide Version **0.1.48**. Im entpackten Build sind `control.readMopModeCloud` und `/v2/miotspec/prop/get` enthalten. Installation erst nach dieser Prüfung freigegeben.
- Draft-PR #3 bleibt offen und ungemergt.

## App-/Adapter-Abgleich: Wasserstufe weicht ab (11.11.2026, ca. 11:41–11:42)

- Nutzer-Screenshot der Xiaomi-App zeigt Standardmodus, Reinigungsart „Saugen vor Wischen“, Saugstärke „Stark“ und Wasserabgabe „Grad 2“ ausgewählt.
- Nachfolgender ioBroker-Screenshot (erfolgreicher Poll um 11:42:48, Poll-Zähler 12) zeigt:
  - `x20Plus.info.mopModeReadback`: `{"siid":4,"piid":5,"code":0,"value":3}`
  - `x20Plus.status.mopMode`: `3`
  - `x20Plus.control.mopMode`: `3` (Admin-Anzeige „Hoch(3)“)
- Damit ist die MIoT-Leseantwort erfolgreich, aber die angezeigte App-Stufe „Grad 2“ und der Adapterwert 3 sind nicht deckungsgleich. Nicht als gelöste bidirektionale Synchronisierung werten.
- Im Code ist die rohe Property SIID 4 / PIID 5 direkt als `mopMode` übernommen; keine Übersetzung findet statt. Die Admin-States beschriften aktuell 1–3 als Niedrig/Mittel/Hoch (zu prüfen, wo die Zuordnung definiert wird).
- Hypothese: Die Firmware-/App-Enum-Zuordnung ist gegenüber der aktuellen Adapterbeschriftung verschoben oder die App-UI-Stufe entspricht nicht direkt dem MIoT-Wert. Noch nicht bestätigt.
- Nächster gezielter Test: App-Wasserstufe auf Grad 1 setzen, nach einem erfolgreichen regulären Poll Rohwert und beide Adapter-States vergleichen. Danach ggf. Grad 3 als Gegenprobe. Keine zusätzliche Poll-Abfrage und keine Codeänderung, bis die Wertetabelle empirisch bestätigt ist.

## Erfolgreiche Diagnose-State-Prüfung nach Neustart (11.11.2026, ca. 11:39)

- Nutzer-Screenshot nach bestätigtem Neustart zeigt `x20Plus.info.mopModeReadback` jetzt vorhanden.
- Der Datenpunkt enthält: `{"siid":4,"piid":5,"code":0,"value":3}`.
- Gleichzeitig sind `connection=true`, ein erfolgreicher `lastPoll` um 11:38:46 und `pollCount=4` sichtbar.
- Damit sind Objekterstellung, regulärer Poll und MIoT-Leseantwort für Wasserstufe SIID 4 / PIID 5 bestätigt. `code: 0` bedeutet erfolgreiche Property-Antwort; `value: 3` entspricht Wasserstufe Hoch.
- Die frühere Annahme, dass der Wert im Poll fehlt, ist damit widerlegt. Die Rückmeldung aus der MIoT-Leseantwort funktioniert grundsätzlich.
- Nächster gezielter Gerätetest: Wasserstufe in der Xiaomi-Original-App auf einen anderen Wert (1 oder 2) ändern und nach dem nächsten erfolgreichen Poll prüfen, ob sich `mopModeReadback.value`, `x20Plus.status.mopMode` und `x20Plus.control.mopMode` entsprechend aktualisieren. Keine zusätzliche Abfrage einbauen.
- Der vorherige Timeout in Batch 1 trat beim Start auf; nachfolgende erfolgreiche Polls sind belegt. Timeout getrennt beobachten, nicht mit dem Readback-Mapping vermischen.

## Nutzerprüfung nach Installation des aktuellen Builds (11.11.2026, ca. 11:37)

- Nutzer hat den aktuellen Branch-Build installiert und den Adapter anschließend manuell neu gestartet.
- Log bestätigt eindeutig: `starting. Version 0.1.48 (non-npm: Apropo1710/ioBroker.roidmi#feature/xiaomi-x20plus)` um 11:37:09.755.
- Um 11:37:14.995 meldete der normale Xiaomi-Poll für Batch 1/4 (`vacuumState:s2p1, fault:s2p2, suction:s2p3, battery:s3p1, chargingState:s3p2, cleaningTime:s4p2, cleaningArea:s4p3, cleaningMode:s4p23`) einen Timeout und startete den vorgesehenen einmaligen Retry. Das ist ein Kommunikations-/Polling-Thema, nicht automatisch ein Wasserstufen-Mappingfehler.
- Der zuvor gezeigte Objektbaum-Screenshot mit nur vier `x20Plus.info`-States stammt von ca. 11:00 Uhr und liegt vor dem bestätigten Neustart. Ob `x20Plus.info.mopModeReadback` nach dem Neustart existiert, ist noch nicht verifiziert. Nicht behaupten, dass der Datenpunkt nach diesem Neustart weiterhin fehlt.
- Nächster Schritt: aktuellen `x20Plus.info`-Objektbaum nach dem Neustart kontrollieren. Falls der State existiert, Wert nach einem erfolgreichen normalen Poll auslesen. Falls er fehlt, gezielt untersuchen, ob das Objekt unmittelbar nach Erstellung wieder entfernt wird bzw. ob ein Fehler beim Objekt-Write protokolliert wird. Keine weitere MIoT-Abfrage ergänzen.

## Aktuelles Hauptthema: Xiaomi X20+ – Wasserstufe wird aus Original-App nicht zurückgelesen

Gerät: Xiaomi Robot Vacuum X20+ (Modell C102GL). Nicht mit Roidmi Eve Plus oder Mova1000 verwechseln.

### Verifiziertes Verhalten am realen Gerät

- `x20Plus.control.cleaningMode`: bidirektional; Änderungen in Adapter und Original-App werden jeweils übernommen.
- `x20Plus.control.suction`: bidirektional.
- `x20Plus.control.mopMode`: Schreiben aus dem Adapter aktualisiert die Original-App.
- Änderung der Wasserstufe in der Original-App aktualisiert dagegen bisher weder `x20Plus.status.mopMode` noch `x20Plus.control.mopMode`; Werte bleiben veraltet.
- Normales Polling läuft. Im Screenshot vom 11.11.2026 waren Verbindung = true und pollCount = 135.
- Der Diagnose-State `x20Plus.info.mopModeReadback` fehlte auch nach Installation der vorigen Diagnoseversion. Nutzer hat dies mit Screenshot belegt; nicht erneut danach fragen.

### MIoT-Zuordnung

- Wasserstufe: SIID 4 / PIID 5, Werte 1–3.
- Saugstufe: SIID 2 / PIID 3.
- Reinigungsart: SIID 4 / PIID 23 (untere zwei Bits).
- Referenz: C102GL-Profil in HA-Xiaomi-Vacuum-Local; Zuordnung ist modellbezogen, muss aber mit Live-Antworten des konkreten Geräts weiter validiert werden.

### Bisherige Diagnoseversuche

- Commit `fe8d1e9` ergänzte `mopModeReadback` als Rohantwort im bestehenden Polling, ohne zusätzliche Roboterabfrage. State erschien beim Nutzer nicht.
- Commit `a93fc34` versuchte Objektanlage per `getObjectAsync`/ACL und scheiterte am TypeScript-Build.
- Commit `11a0a03` verwendete `setObjectNotExistsAsync` plus `extendObjectAsync`; Build erfolgreich, State fehlte weiterhin.
- Commit `aba585f` ergänzte zusätzlich `setObjectAsync` im Xiaomi-Poller. CI und Build erfolgreich, Paketartefakt wurde als `iobroker-roidmi-0.1.35` bezeichnet, enthielt laut Prüfung aber Adapterversion 0.1.48. Nutzer installierte dieses Paket; Diagnose-State fehlte weiterhin.
- Aktueller Commit `e464a4f` legt den Diagnose-State zusätzlich im regulären, awaited `onReady()`-Startpfad an, bevor der Xiaomi-Poller gestartet wird. CI und Build sind erfolgreich. Noch keine Rückmeldung, ob der State auf dem Gerät nun erscheint.

### Nächste Schritte

1. Der aktuelle Head-Build ist erstellt und geprüft; Artefaktversion im Paket ist 0.1.48.
2. Nutzer kann den geprüften Build installieren.
3. Diagnose-State ist vorhanden; Rohantwort bestätigt SIID 4 / PIID 5, code 0, value 3.
4. In der Xiaomi-App Wasserstufe auf 1 oder 2 ändern und nach einem regulären erfolgreichen Poll alle drei Readback-/Status-/Control-Werte vergleichen.
5. Wenn sich der Rohwert ändert, aber Status/Control nicht, Mapping-/State-Synchronisierung gezielt reparieren.
6. Keine zusätzliche MIoT-Abfrage nur für Diagnose einführen.

## Geräte- und Datenpunktstruktur

- Roidmi Eve Plus und Xiaomi X20+ sind getrennte Geräte-Unterbäume.
- Xiaomi: `x20Plus.info`, `x20Plus.status`, `x20Plus.control`, `x20Plus.rooms`.
- `control` ist der gewünschte/schreibbare Wert; `status` ist der vom Roboter zurückgemeldete Wert.
- Nutzer verwendet HomePilot; Objektbaumänderungen müssen dort später berücksichtigt werden, aber erst nach stabiler Adapterstruktur.
- Adapter und Original-App müssen dieselben Einstellungen sehen und gemeinsam nutzen.

## Performance-Leitlinien

- Möglichst wenige MIoT-RPCs; Diagnose aus bestehendem Polling ableiten.
- Kein zusätzliches Polling nur für einen einzelnen Datenpunkt.
- Keine überlappenden Polls; Fehler-Backoff beibehalten.
- Nur geänderte States schreiben (`setStateChangedAsync`).
- Langsam veränderliche Verbrauchs-/Lebensdauerwerte deutlich seltener abfragen.
- Keine unnötigen Logmeldungen im Normalbetrieb.

## Branch-Wechsel und Übernahme der Statusdatei

- Die `STATUS.md` gehört zum jeweiligen Projektstand und wird auf jedem aktiv bearbeiteten Branch mitgeführt.
- Vor einem Branch-Wechsel zuerst den aktuellen Stand dieser Datei sichern und im Zielbranch übernehmen bzw. mit dessen Stand zusammenführen.
- Wird ein Feature-/Fix-Branch in `main` gemergt, muss die aktuelle `STATUS.md` Bestandteil desselben Merge-Ergebnisses sein. Danach wird sie auf `main` weitergeführt.
- Wird ein neuer Branch von einem älteren Stand erstellt, die aktuelle Statusdatei aus dem zuletzt maßgeblichen Branch nachziehen, bevor dort weitergearbeitet wird.
- Nach dem Merge ist `main` die maßgebliche Statusquelle für den übernommenen Projektstand; bei neuer Arbeit auf einem Feature-Branch wird sie dort fortgeschrieben und beim nächsten Merge wieder nach `main` übertragen.
- Keine Statusdatei durch eine ältere Kopie überschreiben: Änderungen aus beiden Branches anhand der Commit-Historie zusammenführen.

## Arbeitsregeln für weitere Chats

1. Vor jeder Arbeit zuerst `STATUS.md` lesen; zusätzlich bei Bedarf `docs/PROJECT_PLAN.md`, `docs/ARCHITECTURE.md` und die betroffenen Quelldateien prüfen.
2. Nach jeder zusammenhängenden Codeänderung `STATUS.md` im selben Commit aktualisieren: Commit-SHA, Änderung, Build-/CI-Ergebnis, offene Tests und nächster Schritt.
3. Nach jedem neuen realen Gerätetest den verifizierten Befund und das Datum ergänzen.
4. Niemals aus dem Artefaktnamen auf die Adapterversion schließen; ZIP-Inhalt kontrollieren.
5. Draft-PR #3 nicht ohne ausdrückliche Freigabe mergen.
6. Keine bereits erledigten Nutzerprüfungen erneut verlangen.
7. Nutzer nicht mit ungeprüften Builds zum Installieren schicken.
8. GitHub Actions für den exakten Commit prüfen; Erfolg von CI und Build getrennt dokumentieren.

## Weitere offene Themen

- Reale Gerätevalidierung der noch nicht getesteten Funktionen und Aktionen.
- Rückmeldung des Nutzers zur Installation des Branch-Head-Builds und zum Datenpunkt `x20Plus.info.mopModeReadback` ausstehend.
- Raum-/Mehrraumsteuerung lokal gegenüber Cloud weiter verifizieren.
- HomePilot-Anbindung an die finale Xiaomi-Objektstruktur anpassen, wenn Adapterstruktur stabil ist.
- Details siehe `docs/PROJECT_PLAN.md` und `docs/PROTOCOL_NOTES.md`.

## Vertiefte Untersuchung Wasserstufe X20+ (11.11.2026, ca. 12:07)

- Nutzer bestätigte per Screenshot, dass in der Xiaomi-App tatsächlich **Grad 1** blau ausgewählt war (Standardmodus, „Saugen vor Wischen“); der Roboter zeigte „Laden beendet“.
- Direkt danach lieferte die lokale MIoT-Abfrage weiterhin `SIID 4 / PIID 5 = 3`, und die manuelle Xiaomi-Cloud-Abfrage ebenfalls `code: 0, value: 3`.
- Beide Cloud-Abfragen (11:02:20Z und 11:06:05Z) lieferten dieselbe `updateTime: 1794386936` = **2026-11-11 08:48:56 UTC (09:48:56 MEZ)**. Der Zeitstempel ist damit deutlich älter als die App-Änderung und die Diagnoseabfragen. Der Wert wurde serverseitig seit diesem Zeitpunkt offenbar nicht aktualisiert.
- Gegenprüfung des exakten Modells anhand einer unabhängigen, hardwarevalidierten Home-Assistant-Integration `roquerodrigo/ha-xiaomi-vacuum`, Datei `custom_components/xiaomi_vacuum/spec/c102gl.py`: `Property.MOP_WATER_LEVEL` ist ausdrücklich auf **SIID 4 / PIID 5** gemappt; Werte 1/2/3 entsprechen Level 1/2/3. Die Integration schreibt diese Property über den normalen MIoT-Property-Setter. Damit ist unsere bisherige Property-Adresse und die Wertetabelle für C102GL unabhängig bestätigt.
- Quelle: https://github.com/roquerodrigo/ha-xiaomi-vacuum/blob/main/custom_components/xiaomi_vacuum/spec/c102gl.py
- Quelle zur Setter-Implementierung: https://github.com/roquerodrigo/ha-xiaomi-vacuum/blob/main/custom_components/xiaomi_vacuum/select/base.py
- Schlussfolgerung: **Kein Beleg für einen falschen SIID/PIID- oder Enum-Mappingfehler.** Die App-Auswahl „Grad 1“ ist auf dem Gerät zum Messzeitpunkt offenbar noch nicht in der live MIoT-Property angekommen (oder die App hält sie zunächst als Einstellung für den nächsten Reinigungslauf). Da der Roboter im Dock und nicht beim Wischen war, ist als nächster aussagekräftiger Test ein kurzer, kontrollierter Wischlauf mit Grad 1 nötig; danach lokale MIoT-Antwort und Cloud-Readback erneut vergleichen. Nicht die Werte im Adapter umbelegen.
- Keine Codeänderung und kein zusätzlicher Poller: Die bestehenden lokalen Polls und der bereits vorhandene manuelle Cloud-Button reichen für den nächsten Test aus. Vor dem Test keine zusätzliche Belastung für Roboter oder ioBroker erzeugen.

### Cloud-Gegenprobe nach Wischlaufversuch (11.11.2026, 12:14 MEZ)

- Nutzer meldete nach dem vorgeschlagenen Wischlaufversuch eine weitere manuelle Cloud-Abfrage: `requestedAt=2026-11-11T11:14:06.637Z`, Ergebnis weiterhin `value: 3`, `code: 0`.
- `updateTime` bleibt exakt `1794386936` (= 08:48:56 UTC / 09:48:56 MEZ), unverändert gegenüber den Cloud-Abfragen um 11:02Z und 11:06Z.
- Damit ist die Xiaomi-Cloud-Property-Antwort für diese DID weiterhin ein alter Datenstand und kein brauchbarer Echtzeit-Nachweis für die App-Änderung bzw. den Wischlauf. Die Cloud-Abfrage liest nur den gespeicherten Cloud-Wert; sie stößt keinen Live-Read am Roboter an.
- Nächster entscheidender Nachweis ist ausschließlich der lokale `x20Plus.info.mopModeReadback` aus dem regulären MIoT-Poll während/nachdem der Roboter tatsächlich wischt. Diesen Wert samt Poll-Zeitpunkt prüfen; keine weitere Cloud-Abfrage nötig. Wenn lokal ebenfalls 3 bleibt, den Versuch nicht als Fehler des Cloud-Mappings interpretieren; dann ist zu untersuchen, ob die App-Einstellung im gewählten Reinigungsmodus erst bei Jobstart/Übernahme geschrieben wird.

## Diagnose: Xiaomi Cloud datasource 1 liefert veralteten Cache (11.11.2026)

- Neue Recherche ergab einen konkreten Unterschied der MIoT-Cloud-Abfragequellen: `datasource: 1` ist der automatische/cache-basierte Abruf; `datasource: 2` wird in einer aktuellen unabhängigen Xiaomi-Cloud-Implementierung ausdrücklich als direkter Geräteabruf verwendet.
- Referenz mit realen, redigierten Live-Antworten dokumentiert einen reproduzierten Fall: `datasource:1` lieferte einen alten gecachten Wert, `datasource:2` danach einen anderen direkten Gerätewert (synthetische Zeitstempel in den veröffentlichten Fixtures). Quelle: https://github.com/eyaeya/xiaomi-central-hub-gateway-cli/blob/main/fixtures/responses/cloud-live/README.md
- Das passt exakt zu unserem Befund: drei Abfragen über `datasource:1` lieferten unverändert `value:3` und `updateTime=1794386936` (09:48:56 MEZ), obwohl der Nutzer die App auf Grad 1 umgestellt und einen Wischlaufversuch durchgeführt hatte.
- Codeänderung: `XiaomiCloudMapClient.getProperties()` unterstützt jetzt explizit `datasource: 1 | 2` (Default bleibt 1, damit bestehende Aufrufer unverändert bleiben). Der manuelle Diagnosebutton `x20Plus.control.readMopModeCloud` verwendet nun gezielt `datasource:2` und schreibt `datasource:2` in den Diagnose-Snapshot. Das betrifft nur den manuellen Einzelabruf, nicht den Poller und keine Schreiboperation.
- Commits: `8ce7970911aabb42ed7aa7ee898ce60d88f473e3` (datasource-Parameter), `ad971613b1dceef13ec15beaf01f25c4b79b4699` (direkte Gerätequelle für Diagnose). Build/CI für diesen neuen Stand noch ausstehend.
- Nächster Schritt: CI und Test/Build für den exakten Branch-Head abwarten, Artefaktinhalt und Adapterversion prüfen. Erst danach Nutzer um genau einen erneuten manuellen Diagnoseabruf bitten. Erwartung: entweder aktueller Wert 1, oder ein aussagekräftiger Fehler, falls das Gerät direkte Cloud-Abfrage nicht unterstützt. Keine Wertezuordnung ändern, bis dieser Test vorliegt.
