# Projektstatus – ioBroker.roidmi

Zuletzt aktualisiert: 11.11.2026  
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
- Neue Code-Commits: `007b1cdf26e6b68a86bef477b07240f91c1e2c47` (Cloud-Property-Read) und `f259c092bc2c3c3f39ccd30097c3c63c88c93bee` (manueller Diagnose-Button). Noch kein Build als installierbar freigegeben; CI/Tests abwarten.
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
