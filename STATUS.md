# Projektstatus – ioBroker.roidmi

Zuletzt aktualisiert: 11.11.2026  
Aktiver Entwicklungsbranch: `feature/xiaomi-x20plus`  
Repository: https://github.com/Apropo1710/ioBroker.roidmi  
Draft-PR: https://github.com/Apropo1710/ioBroker.roidmi/pull/3 (nicht mergen)

> Diese Datei ist die zentrale Übergabe für neue Chats. Vor jeder weiteren Änderung zuerst diese Datei lesen und sie im selben Arbeitsgang wie die Codeänderung aktualisieren.

## Aktueller Stand

- Neuester Commit: `e464a4fbf3768d76db32cb87944c66cdb8399bf0`
- Commit-Nachricht: `Create Xiaomi mop diagnostic state during adapter startup`
- GitHub Actions für genau diesen Commit:
  - CI #374: erfolgreich
  - Test and build adapter #146: erfolgreich
- Die tatsächliche Adapterversion steht in `package.json` / `io-package.json`, nicht im Namen des GitHub-Artefakts. Vor Weitergabe eines ZIP immer die Paketversion prüfen.
- Der letzte bekannte Build vor diesem Commit war Adapterversion 0.1.48; Artefaktnamen wie `iobroker-roidmi-0.1.35` sind nicht als Versionsquelle geeignet.

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

1. Build-Artefakt für Commit `e464a4f` abrufen und tatsächliche Version in `package.json` sowie `io-package.json` prüfen.
2. Nutzer erhält erst danach Installationspaket und eine knappe Testanweisung.
3. Nach Installation nur prüfen, ob `x20Plus.info.mopModeReadback` jetzt existiert und welchen Rohwert der normale Poll liefert.
4. Falls State weiterhin fehlt: nicht weitere zufällige Erstellungsvarianten probieren. Startup-/Objektbaum-Lifecycle, Namespace, Objektlöschung/Migration und Adapter-Log gezielt anhand Code und ioBroker-Verhalten untersuchen.
5. Wenn State erscheint: Rohantwort auswerten (SIID/PIID/code/value), um zu unterscheiden zwischen nicht aktualisierter Geräte-Property, Fehlercode/Lesesperre oder Mapping-Problem.
6. Keine zusätzliche MIoT-Abfrage nur für Diagnose einführen; den bereits laufenden Poll verwenden, um Roboterlast gering zu halten.

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
- Raum-/Mehrraumsteuerung lokal gegenüber Cloud weiter verifizieren.
- HomePilot-Anbindung an die finale Xiaomi-Objektstruktur anpassen, wenn Adapterstruktur stabil ist.
- Details siehe `docs/PROJECT_PLAN.md` und `docs/PROTOCOL_NOTES.md`.
