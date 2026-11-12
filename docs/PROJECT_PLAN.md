# Projektplan

## Phase 0 – Gerät und Protokoll validieren
- [ ] Modell/Firmware und lokale Netzwerkadresse am realen Gerät erfassen
- [ ] MIoT-/miIO-Token sicher beschaffen und lokal halten
- [ ] Read-only-Verbindung am realen Gerät testen
- [x] Dokumentiertes MIoT-Format für Einzel- und Mehrraumreinigung als getesteten Payload-Builder abbilden
- [ ] Tatsächlich unterstützte Properties, Actions, Raum-IDs und Fehlercodes am Gerät dokumentieren
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
  - [ ] Roidmi EVE Plus: Bearbeitung bestehender Zeitpläne (Adapter-Schreibpfad angelegt; CI und Hardwaretest offen)
- [ ] Staubabsaugung und Wartungsreset-Funktionen, soweit sicher verifiziert

## Phase 4 – Qualität und Veröffentlichung
- [x] CI-Build und automatisierte Unit-Tests
- [ ] Integrationstest mit realem Roidmi EVE Plus
- [ ] ioBroker-Repository-Konventionen und Adapter-Validierung
- [ ] Release-Prozess und vollständige Dokumentation

## Phase 5 – Integration
- [ ] HomePilot-Anbindung (begonnen: Startseiten-Kachel, Statusansicht und Kernbefehle in HomePilot; reale Geräteausführung noch nicht bestätigt)

**Wichtiger Statushinweis:** Grüne CI-Läufe bestätigen Build und Unit-Tests, nicht die reale Gerätekommunikation. Start-/Pause-/Fortsetzen-/Dock-Mappings sind anhand veröffentlichter V60-Profile hinterlegt und müssen am konkreten Gerät noch bestätigt werden.


**Raumimport:** Siehe [ROOM_IMPORT.md](ROOM_IMPORT.md). Der Import ist bewusst manuell und erzeugt keine zusätzliche Roboterabfrage. Automatische Karten-/Raumerkennung sowie die reale Ausführung bleiben separate offene Punkte.
