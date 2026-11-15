# Projektplan

## Phase 0 – Gerät und Protokoll validieren
- [ ] Modell/Firmware und lokale Netzwerkadresse am realen Gerät erfassen
- [ ] MIoT-/miIO-Token sicher beschaffen und lokal halten
- [ ] Read-only-Verbindung am realen Gerät testen
- [x] Dokumentiertes MIoT-Format für Einzel- und Mehrraumreinigung als getesteten Payload-Builder abbilden
- [ ] Tatsächlich unterstützte Properties, Actions, Raum-IDs und Fehlercodes am Gerät dokumentieren
- [x] Xiaomi X20+ Mehrraumreinigung in Modus 3 mit drei Räumen hardwarevalidiert (15.11.2026: Toilette 1, Küche 2, Wohnzimmer 4; alle drei erst gesaugt, danach gewischt; fünfter Wert jeder Raumzeile = 1, siehe PROTOCOL_NOTES.md)
- [ ] Xiaomi X20+ Mehrraumreinigung mit mehr als drei Räumen und weiteren Raumkombinationen testen
- [ ] Xiaomi X20+ Mehrraumreinigung in weiteren Modi (insbesondere Saugen und Wischen gleichzeitig) testen
- [ ] Gebündelte Sieben-Property-Abfrage (1 RPC statt 7) am realen Gerät auf vollständige und korrekt zugeordnete Antworten prüfen
- [ ] Prüfen, welche Funktionen lokal und welche nur über Cloud verfügbar sind

## Phase 1 – Adapterbasis
- [x] TypeScript-Projektgerüst
- [x] Konfigurationsvalidierung einschließlich IPv4-, DID- und Tokenformat
- [x] Secret-Redaction-Helfer
- [x] ioBroker-Adapter-Core integrieren
- [x] Konfiguration, lokaler miIO-Transport, Polling und Backoff als Grundgerüst
- [x] Basis-Objekt-/State-Modell und automatisierte Tests

## Phase 2 – Kernsteuerung (inkl. priorisierter Raumsteuerung)
- [x] Basisstatus, Akku und Ladezustand als Datenpunkte
- [x] Datenpunkte und protokollbasierte MIoT-Mappings für Start / Pause / Fortsetzen / Dock
- [x] Fehler- und Verbindungsstatus als Datenpunkte
- [x] Saugstufe, Reinigungsart und Wasserstufe als les-/schreibbare Datenpunkte mit Wertevalidierung (Geräteausführung noch offen)
- [x] Manueller, validierter Raumkarten-Import mit persistenter Speicherung und dynamischen Einzelraum-Datenpunkten (automatische Ermittlung bleibt offen)
- [x] Raumaufteilung bzw. Raumliste aus V60-Cloud-Kartenmetadaten automatisch ermitteln
- [x] mapId und Raum-/Segment-IDs aus den Kartenmetadaten übernehmen und persistent ablegen, sofern die Karte eine gültige mapId enthält (Fallback bleibt manueller Import); reale Geräteausführung noch offen
- [x] Importierte Räume mit stabilen Segment-IDs, lesbaren Namen und Einzelraum-Reinigungsbuttons als ioBroker-Objekte abbilden
- [x] JSON-Schnittstelle für Einzelraumreinigung im Adapter bereitstellen (Geräteausführung noch offen)
- [x] JSON-Schnittstelle für Mehrraumreinigung in einem Auftrag bereitstellen (Geräteausführung noch offen)
- [x] Importierte Raum-IDs und Zuordnungen dauerhaft erhalten; Wiederherstellung beim Adapterstart
- [ ] Verfügbarkeit und Grenzen der Raumsteuerung lokal gegenüber Cloud verifizieren
- [ ] Raumprofile pro Segment (Saugstufe/Reinigungsart/Wasserstufe) anhand des tatsächlichen Original-App-Aufrufs protokollseitig verifizieren

## Phase 3 – Weitere Erweiterungen
- [ ] Zonenreinigung
- [ ] Karten und Reinigungsverlauf
- [ ] Zeitpläne / Wartungsdaten, soweit verfügbar
  - [ ] Roidmi EVE Plus: Bearbeitung bestehender Zeitpläne ist im Adapter implementiert; Feature-Branch 0.1.66 und CI-/Build #320 erfolgreich. HomePilot-Editor und bidirektionale Synchronisation sind vorhanden/bestätigt; gezielter Hardwaretest einer Zeitplan-Schreibänderung bleibt offen.
- [ ] Staubabsaugung und Wartungsreset-Funktionen, soweit sicher verifiziert

## Phase 4 – Qualität und Veröffentlichung
- [x] CI-Build und automatisierte Unit-Tests
- [ ] Integrationstest mit realem Roidmi EVE Plus
- [ ] ioBroker-Repository-Konventionen und Adapter-Validierung
- [ ] Release-Prozess und vollständige Dokumentation

## Phase 5 – Integration
- [ ] HomePilot-Anbindung (begonnen: Startseiten-Kachel, Statusansicht und Kernbefehle in HomePilot; reale Geräteausführung noch nicht bestätigt)

**Aktualisiert 13.11.2026:** Aktiver Entwicklungsstand `feature/xiaomi-x20plus`, Version 0.1.66, Head `33252606a220444756a4a01b6952de7eacb14ee0`, CI-/Build #320 erfolgreich. Grüne CI-Läufe bestätigen Build und Unit-Tests, nicht die reale Gerätekommunikation. Start-/Pause-/Fortsetzen-/Dock-Mappings sind anhand veröffentlichter V60-Profile hinterlegt und müssen am konkreten Gerät noch bestätigt werden.


**Raumimport:** Siehe [ROOM_IMPORT.md](ROOM_IMPORT.md). Der Import ist bewusst manuell und erzeugt keine zusätzliche Roboterabfrage. Automatische Karten-/Raumerkennung sowie die reale Ausführung bleiben separate offene Punkte.


**Live-Testnotiz 14.11.2026:** Bei der Xiaomi-X20+-Mehrraumreinigung im Modus 3 wurden Toilette (Segment 1) und Flur unten (Segment 8) getestet. Der fünfte Wert `1,2` wählte nur Toilette; `1,1` zeigte beide Räume in Xiaomi Home. Der Drei-Raum-Hardwaretest vom 15.11.2026 war erfolgreich; weitere Raumkombinationen und mehr als drei Räume sind noch offen. Details: [Protokollnotizen](PROTOCOL_NOTES.md#live-test-xiaomi-x20--mehrraumreinigung-in-modus-3-14112026).


**Adapterkorrektur 15.11.2026 / Version 0.1.68:** Der fünfte Wert jeder Raumzeile im X20+-Mehrraum-Payload wird jetzt konstant auf `1` gesetzt. Grundlage ist der erfolgreiche Zwei- und Drei-Raum-Hardwaretest in Modus 3. Regressionstest für drei Räume ergänzt. Nächster Hardwaretest: dieselbe Drei-Raum-Kombination in „Saugen und Wischen gleichzeitig“ am 16.11.2026. Andere Modi bleiben offen.
