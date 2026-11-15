# Protokollnotizen

## Gerätekennung und MIoT
- Bekannte Gerätekennung: `roidmi.vacuum.v60` (Roidmi EVE Plus).
- MIoT-Aufrufe benötigen die numerische Xiaomi-Gerätekennung `did` (Mi Home device ID); sie ist nicht mit der lokalen miIO-Header-Device-ID gleichzusetzen.
- Die Adapterkonfiguration enthält deshalb ein eigenes DID-Feld. Es wird nicht aus der lokalen Handshake-Antwort geraten.
- MIoT / miIO ist der vorrangige technische Untersuchungsansatz.
- `python-miio` und Home Assistant / openHAB dienen als Protokollreferenzen, nicht als Laufzeitabhängigkeiten.

## Verifizierte V60-Aktionen (Quellenprofil)
- Ganze Karte starten: SIID 14 / AIID 1, Eingaben `[1, ""]`.
- Pause: SIID 8 / AIID 8.
- Fortsetzen: SIID 8 / AIID 5.
- Zur Ladestation: SIID 3 / AIID 1 (Battery / start-charge).
- Reinigung stoppen: SIID 2 / AIID 2.
- Raum-/Zonenreinigung: SIID 14 / AIID 1, Eingaben `[2, JSON.stringify({ mapId, segmentId: [roomId, ...] })]`.
- Mehrere Räume werden als mehrere IDs in demselben `segmentId`-Array übergeben.

Diese Zuordnungen stammen aus dem veröffentlichten MIoT-Profil und dem openHAB-Geräteprofil. Sie sind noch nicht am konkreten Gerät mit dessen Firmware ausgeführt worden.

## Raumreinigung
- `did` ist die numerische Xiaomi-Gerätekennung.
- `mapId` stammt aus der aktiven Xiaomi-Karte bzw. den Mi Home-Debug-Logs.
- Raum-/Segment-IDs können über die Roidmi-Kartenmetadaten bzw. Xiaomi Cloud Map Extractor (`room_numbers`) ermittelt werden.
- Der Adapter stellt den Schreib-Datenpunkt `control.cleanRooms` bereit. Er erwartet JSON im Format `{"mapId":12345,"roomIds":[1,3]}` und setzt die Raum-IDs in `segmentId` um.
- Die Payload-Erzeugung ist getestet; Ausführung und die automatische Beschaffung von `mapId`/Raumliste sind am realen Gerät noch nicht validiert.
- Die generische MIoT-Aktion `vacuum.start-room-sweep` (SIID 2 / AIID 3) ist im Spec gelistet, aber für den bekannten EVE-Plus-Workflow wird die herstellerspezifische Sweep-Aktion oben verwendet.

## Eigenschaften und Polling
- Akku: SIID 3 / PIID 1 (battery level), SIID 3 / PIID 2 (charging state).
- Roboterstatus: SIID 2 / PIID 1.
- Fehlercode: SIID 2 / PIID 2.
- Saugstufe: SIID 2 / PIID 4.
- Reinigungsart: SIID 2 / PIID 8.
- Wischaufsatz vorhanden: SIID 8 / PIID 1.
- Wasserstufe: SIID 8 / PIID 11, Werte 0=Aus, 1=Gering, 2=Mittel, 3=MAX, 4=Stufe 4.
- Karten-/Raumfunktionen liegen im Service SIID 13; viele Properties dort sind nicht als lesbar ausgewiesen.
- Das openHAB-V60-Profil setzt ausdrücklich `maxProperties: 1`. Der Adapter liest daher eine Property pro RPC und vermeidet parallele/gebündelte Anfragen.

## Karten- und Raumdaten
- Der Roidmi-Kartenparser verarbeitet explizit übergebene gzip-Archive. Nach dem 16-Byte-Präfix und dem Rasterbereich markiert Byte `0x7f` den Beginn der JSON-Metadaten; das folgende Byte ist die öffnende geschweifte Klammer.
- Die Metadaten enthalten unter anderem `width`, `height`, `resolution`, `x_min`, `y_min` und `autoArea`/`autoAreaValue`.
- Der Xiaomi Cloud Map Extractor unterstützt `roidmi.vacuum.v60` und kann `room_numbers` und `rooms` liefern. Dafür ist eine separate Xiaomi-Cloud-Konfiguration erforderlich.
- Die `mapId` muss für den dokumentierten Raumreinigungsaufruf separat aus der aktiven Mi Home-Karte bzw. den Debug-Logs ermittelt werden; sie darf nicht aus der lokalen miIO-Header-ID abgeleitet werden.
- Kartenabrufe gehören nicht in den regelmäßigen Status-Polling-Zyklus. Eine Cloud-Anbindung bleibt optional und muss getrennt von lokaler Steuerung ausgewiesen werden.

## Sicherheit und Last
- Token niemals in Git, Screenshots oder ungeschützte Logs übernehmen.
- Erste Gerätetests ausschließlich lesend durchführen.
- Der Adapter liest im konservativen V60-Profil eine Property je RPC, ohne überlappende Pollzyklen.
- Zustände werden nur bei Änderung geschrieben; bei Fehlern greift exponentieller Backoff.
- Karten und Verlauf nur bei Bedarf abrufen, nicht im schnellen Status-Poll.

## Quellen
- Xiaomi MIoT Spec: https://home.miot-spec.com/spec?type=urn:miot-spec-v2:device:vacuum:0000A006:roidmi-v60:3
- openHAB V60 profile: https://github.com/openhab/openhab-addons/blob/main/bundles/org.openhab.binding.miio/src/main/resources/database/roidmi.vacuum.v60-miot.json
- Roidmi EVE Plus room-cleaning workflow: https://community.home-assistant.io/t/roidmi-eva-integration/450084/8
- Xiaomi Cloud Map Extractor support: https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor

## Raumprofile – Protokollrecherche (Stand 01.11.2026)
- Die V60-MIOT-Zuordnung in python-miio kennt `timing` als SIID 8 / PIID 6. Der Wert ist ein JSON-String für wiederkehrende Reinigungspläne.
- Ein Plan-Eintrag enthält unter anderem Startzeit, Aktivierung, Saugstufe, Reinigungsart, Wochentage, Wasserstufe und eine Liste von Raum-IDs. Beispiel und Feldreihenfolge sind in der python-miio-Dokumentation beschrieben.
- Der dokumentierte Setter `set_timing` schreibt diese Property und weist ausdrücklich darauf hin, dass vorhandene Zeitpläne überschrieben werden. Deshalb darf der Adapter diese Property nicht als vermeintlichen Sofortbefehl für Raumprofile verwenden.
- Die MIoT-Aktion `start_room_sweep` (SIID 2 / AIID 3) ist zwar im Mapping aufgeführt, python-miio markiert die Eingabeparameter jedoch weiterhin als unbekannt. Ein aktueller Bericht zur lokalen V60-Steuerung beschreibt ebenfalls fehlgeschlagene Versuche mit dieser Aktion und mit PIID 9. Das ist ein Hinweis auf eine offene Protokollfrage, kein Beweis, dass Raumreinigung generell unmöglich ist.
- Konsequenz: Noch keine automatische Umschaltung von Saug-/Wasserwerten vor einer Raumreinigung einbauen. Das wäre nicht gleichwertig zu echten Raumprofilen und könnte bei Fehlern die globalen Einstellungen verändern.
- Nächster sicherer Schritt zur vollständigen Umsetzung: Einmalig den tatsächlichen lokalen MIoT-/miIO-Verkehr beim Start einer Raumreinigung mit abweichenden Raumprofilen aus der Original-App erfassen (Anfrageparameter und Reihenfolge, Token schwärzen). Alternativ kann ein reproduzierbarer Export/Debug-Log der App verwendet werden. Erst danach wird der bestätigte Aufruf implementiert und getestet.

Quellen:
- python-miio V60-Mapping und Timing-Format: https://python-miio.readthedocs.io/en/latest/_modules/miio/integrations/roidmi/vacuum/roidmivacuum_miot.html
- Bericht zu offenen lokalen Raumreinigungsaufrufen: https://github.com/al-one/hass-xiaomi-miot/issues/2969


## Live-Beobachtungen am Roidmi EVE Plus (02.11.2026)

Diese Werte stammen aus Screenshots des realen Geräts. Sie sind Beobachtungen, keine endgültig bestätigte Enum-Tabelle.

| Situation | Akku | charging (SIID 3 / PIID 2) | state (SIID 2 / PIID 1) | Fehlercode | Beobachtung |
|---|---:|---:|---:|---:|---|
| Angedockt, voll geladen | 100 % | 1 | 9 | 0 | Xiaomi Home zeigte Ladung/voll geladen. |
| Reinigung läuft | 98 % | 2 | 4 | 0 | Reinigung war in der Original-App aktiv. |
| Nach Reinigung/Unterbrechung außerhalb der Station | 94 % | 2 | 3 | 0 | App zeigte „aussetzen“ bzw. Standby-ähnlich. |
| Rückfahrt zur Station | 94 % | 2 | 5 | 0 | Nutzer vermutet Rückkehrstatus; noch nicht endgültig verifiziert. |
| Andocken plus automatische Behälterabsaugung | 99 % | 1 | 6 | 0 | Roboter stand in der Station; Absaugung erfolgte nach Andocken. |
| Später angedockt und voll geladen | 100 % | 1 | 9 | 0 | Status erneut beobachtet. |

### Vorläufige Interpretation
- `charging=1` tritt angedockt bei 99 % und 100 % auf. Das ist kein Beweis für aktives Laden; vorerst als Rohwert „Lade-/Dockstatus“ behandeln, nicht eindeutig als „Akku lädt“ übersetzen.
- `state=5` passt zur beobachteten Rückkehr, ist aber noch eine Hypothese.
- `state=6` trat nach dem Andocken im Zusammenhang mit der automatischen Staubbehälterabsaugung auf.
- `state=9` wurde bei vollständig geladenem, angedocktem Roboter beobachtet.
- `state=3` trat nach dem Ende/Abbruch außerhalb der Station auf. Daraus folgt keine bestätigte Fortsetzen-Funktion.
- Nutzerbeobachtung: Fortsetzen nach einer Unterbrechung könnte bei diesem Roidmi eine neue Reinigung starten statt die Route wiederaufzunehmen. Bis zur Verifikation darf der Adapter keine Wiederaufnahme der vorherigen Route versprechen.
- Weitere Tests bevorzugt passiv mit den normalen Statuspolls. Keine wiederholten Stop-/Resume-/Dock-Befehle nur zum Erzeugen von Statuswerten.


## Empirische Statuslabels
- Neue lesbare Datenpunkte `stateText` und `chargingText`; Rohdatenpunkte bleiben unverändert.
- `charging=1` wird nicht als aktives Laden interpretiert; Bedeutung ungeklärt.
- Status 5 und 6 sind empirisch/vorläufig. Unbekannte Werte bleiben sichtbar.

## Xiaomi X20+ – gepackte Wasserstufe (11.11.2026)

- Protokollhinweis/Referenz: Der X20+-Support im Projekt `ha-xiaomi-vacuum` dokumentiert SIID 4 / PIID 23 als gepackten Einstellungswert. Der Hinweis führte zur Untersuchung dieses Feldes; die konkrete Bitlage wurde anhand von Messungen aus der Xiaomi-Original-App und anschließendem bidirektionalem Test am realen Gerät bestätigt.
- SIID 4 / PIID 23 Rohwerte aus der Original-App:
  - Wasserstufe Grad 1: `67585` (`0x10801`)
  - Wasserstufe Grad 2: `133121` (`0x20801`)
  - Wasserstufe Grad 3: `198657` (`0x30801`)
- Im getesteten Gerät ändern sich für die Wasserstufe ausschließlich Bits 16–17: Maske `0x30000`, Shift `16`. Dekodierung: `(rawValue >>> 16) & 0x03`; Werte 1, 2 und 3 entsprechen Grad 1, 2 und 3.
- Beim Schreiben ausschließlich diese Bits ersetzen und alle übrigen Bits des gepackten Werts erhalten. Der Adapter liest den aktuellen Wert vor dem Schreiben und verifiziert den Schreibvorgang durch Readback.
- Live-Verifikation: Änderungen mehrfach in beide Richtungen getestet – Xiaomi-Original-App → Adapter und Adapter → Xiaomi-Original-App. Beide Richtungen funktionieren auf dem getesteten Gerät.
- Firmware-Version des Testgeräts ist derzeit nicht erfasst. Die Bitbelegung ist daher für dieses Gerät/Firmware bestätigt, aber nicht als firmwareübergreifend garantiert anzusehen. Bei Tests mit anderen Firmwareständen Rohwerte und Firmware-Version ergänzen.
- Lastverhalten: Die Wasserstufe wird aus dem bereits vorhandenen Pollwert 4/23 abgeleitet. Keine zusätzliche periodische Abfrage hinzufügen.


## Roidmi EVE Plus – Zeitplanformat und Schreibschutz (12.11.2026)

- Live-Rohdaten vom realen EVE Plus bestätigen get_properties / set_properties auf SIID 8 / PIID 6 mit JSON-Root { time: [...], tz, tzs }.
- Jeder beobachtete Zeitplaneintrag besitzt mindestens acht Felder: [timeSeconds, enabled, fanSpeed, cleaningMode, weekdays, waterLevel, roomIds, trailingValue]. Die beobachteten Aktivierungswerte sind 0 (deaktiviert); die Adapterinterpretation nutzt 1 als aktiviert. Feld 7 und mögliche zusätzliche Felder werden unverändert erhalten.
- Beispielwerte aus dem Gerät: 35280 Sekunden = 09:48, 17700 Sekunden = 04:55; Wochentage verwenden 0 = Sonntag bis 6 = Samstag. Saugstufen 0–4 und Wasserwerte 0–4 entsprechen dem vorhandenen Parser-Mapping. Die numerische Bedeutung der Reinigungsart bleibt vorerst bewusst unverändert/roh.
- Der Schreibpfad bearbeitet nur vorhandene Einträge. Keine Neuanlage oder Löschung. Die UI muss den vollständigen zuvor angezeigten raw-Snapshot zusammen mit dem Änderungsobjekt übergeben.
- Sicherheitsablauf: aktuellen Wert frisch lesen → Snapshot strukturell vergleichen → ausschließlich explizite Felder ändern → vollständigen JSON-Wert schreiben → direkt zurücklesen → strukturell prüfen, dass nur die angeforderten Felder verändert wurden. Bei Snapshot-Konflikt wird vor dem Schreiben abgebrochen.
- Nach MIoT-Schreibannahme und fehlgeschlagenem Readback wird der Ausgang ausdrücklich als unbestätigt gemeldet. Kein automatischer Wiederholungsversuch.
- Alle Lese-/Schreib-/Readback-Aufrufe erfolgen ausschließlich auf explizite Benutzeraktion; keine Zeitplanabfrage im regulären Polling.


## Live-Test Xiaomi X20+ – Mehrraumreinigung in Modus 3 (14.11.2026)

**Testumgebung:** Xiaomi X20+ über lokalen miIO-UDP-Transport; Adapter-Branch `feature/xiaomi-x20plus`. Der Test wurde mit einem separaten ioBroker-JavaScript-Testskript durchgeführt. Die Roidmi-Adapterinstanz war während der direkten miIO-Aufrufe gestoppt. Zugangsdaten wurden lokal aus der Adapterkonfiguration gelesen und nicht protokolliert.

**Reinigungsmodus:** `3` (in der Bedienoberfläche „Saugen vor Wischen“).

**Räume:**
- Segment-/Raum-ID `1`: Toilette
- Segment-/Raum-ID `8`: Flur unten

Beide Aufrufe verwendeten dieselbe MIoT-Aktion (SIID 4 / AIID 1), dieselben übrigen Parameter und wurden vom Roboter jeweils mit `code: 0` beantwortet. Geändert wurde ausschließlich der fünfte Wert des zweiten Eintrags in `selects`:

| Variante | `selects` | Beobachtung in Xiaomi Home |
|---|---|---|
| A | `[[1,1,1,2,1],[8,1,1,2,2]]` | Nur Toilette wurde als ausgewählter Raum angezeigt |
| B | `[[1,1,1,2,1],[8,1,1,2,1]]` | Toilette und Flur unten wurden beide als ausgewählte Räume angezeigt |

**Vorläufige Schlussfolgerung:** Für diese getestete Zwei-Raum-Kombination im Modus 3 muss der fünfte Wert beider Raumeinträge offenbar `1` sein. Ein fortlaufender Wert `1,2` führte dazu, dass nur der erste Raum ausgewählt wurde. Die Annahme, dass alle Raumeinträge unabhängig von der Anzahl denselben fünften Wert `1` benötigen, ist noch nicht für drei oder mehr Räume und nicht für alle Raumkombinationen bestätigt.

**Noch nicht nachgewiesen:** Die Anzeige beider Räume in Xiaomi Home bestätigt die Mehrraumauswahl, aber dieser Test allein belegt noch nicht den vollständigen erfolgreichen Reinigungsdurchlauf beider Räume.

**Nächste Schritte:**
- Drei-Raum-Reinigung mit fünftem Wert `1` für jeden Eintrag testen.
- Weitere Raumkombinationen testen.
- Danach den Payload-Builder gezielt anpassen und Regressionstests für Einzelraum-, Mehrraum- und die übrigen Reinigungsmodi ergänzen.

Bis zu diesen Prüfungen bleibt dies eine dokumentierte Live-Beobachtung und noch keine implementierte Adapterkorrektur.


## Hardwaretest Xiaomi X20+ – Drei-Raum-Reinigung in Modus 3 erfolgreich (15.11.2026)

- Nach dem Zwei-Raum-Test vom 14.11. wurde die Mehrraumreinigung mit drei Räumen am realen Xiaomi X20+ ausgeführt.
- Verwendete Segment-IDs laut aktuellem `x20Plus.rooms.roomsJson`: Toilette `1`, Küche `2`, Wohnzimmer `4`. Die zuvor angenommene Wohnzimmer-ID `5` war falsch; `5` ist lediglich die sichtbare Kartenbezeichnung eines unbenannten Kartensegments und nicht die Segment-ID des Wohnzimmers.
- MIoT-Aktion weiterhin SIID 4 / AIID 1, Modus 3 („Saugen vor Wischen“). Payload-Raumzeilen: `[[1,1,1,2,1],[4,1,1,2,1],[2,1,1,2,1]]`.
- Der Nutzer bestätigte den vollständigen realen Ablauf: Zuerst wurden alle drei Räume gesaugt, danach wurden Toilette, Küche und Wohnzimmer nacheinander gewischt. Das Wohnzimmer befand sich zuletzt im Wischvorgang; der Nutzer bestätigte ausdrücklich, dass alle drei Räume gesaugt und anschließend gewischt wurden.
- Damit ist die Drei-Raum-Ausführung in Modus 3 hardwarevalidiert. Zusammen mit dem Zwei-Raum-Test ist belegt, dass in diesen getesteten Payloads der fünfte Wert jeder Raumzeile `1` sein muss.
- Xiaomi Home stellte die Küche in der Auswahl-/Reinigungskarte hellblau dar, während Toilette und Wohnzimmer kräftiger blau erschienen. Trotz des Farbunterschieds wurde die Küche vollständig gesaugt und gewischt. Die Bedeutung der unterschiedlichen Farbe bleibt ungeklärt; keine Interpretation als abweichender Reinigungsmodus ableiten.
- Noch offen: weitere Raumkombinationen, mehr als drei Räume sowie andere Reinigungsmodi (insbesondere Saugen und Wischen gleichzeitig). Noch keine Änderung am Adapter-Payload-Builder vorgenommen; die Tests erfolgten über ein separates ioBroker-JavaScript-Testskript. Adapterversion bleibt `0.1.67`; kein Code-Build aus diesem Hardwaretest abgeleitet.


## Xiaomi X20+ Mehrraum-Payload korrigiert – Version 0.1.68 (15.11.2026)

- Grundlage: Live-Hardwaretests mit zwei Räumen (14.11.) und drei Räumen (15.11.) im Modus 3. Bei fortlaufendem fünften Feld `1,2` wurde nur der erste Raum ausgewählt; mit konstantem fünften Feld `1` wurden drei Räume tatsächlich vollständig erst gesaugt und anschließend gewischt.
- `buildXiaomiRoomCleanAction` setzt deshalb den fünften Wert jeder `selects`-Zeile jetzt konstant auf `1`, unabhängig von der Position des Raums. Übrige Parameter und Validierungen bleiben unverändert.
- Regressionstests aktualisiert und um einen expliziten Drei-Raum-Payload ergänzt.
- **Wichtig:** Der erfolgreiche Hardwaretest gilt bisher für Modus 3 („Saugen vor Wischen“). Ob dieselbe Payload-Korrektur auch mit „Saugen und Wischen gleichzeitig“ und anderen Modi funktioniert, ist noch offen und soll nach Installation von 0.1.68 am 16.11.2026 getestet werden.
- Version **0.1.68**. HomePilot muss für diese Adapteränderung nicht geändert werden.
