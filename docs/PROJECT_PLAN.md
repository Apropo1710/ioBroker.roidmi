# Projektplan

## Phase 0 – Gerät und Protokoll validieren
- [ ] Modell/Firmware und lokale Netzwerkadresse am realen Gerät erfassen
- [ ] MIoT-/miIO-Token sicher beschaffen und lokal halten
- [ ] Read-only-Verbindung am realen Gerät testen
- [x] Dokumentiertes MIoT-Format für Einzel- und Mehrraumreinigung als getesteten Payload-Builder abbilden
- [ ] Tatsächlich unterstützte Properties, Actions, Raum-IDs und Fehlercodes am Gerät dokumentieren
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
- [ ] Saugmodus und Wasserstufe als Datenpunkte und Steuerung
- [ ] Raumaufteilung bzw. Raumliste ermitteln
- [ ] Aktuelle mapId und Raum-/Segment-IDs automatisch ermitteln und persistent ablegen
- [ ] Räume mit stabilen Raum-IDs und lesbaren Namen als ioBroker-Objekte abbilden
- [x] JSON-Schnittstelle für Einzelraumreinigung im Adapter bereitstellen (Geräteausführung noch offen)
- [x] JSON-Schnittstelle für Mehrraumreinigung in einem Auftrag bereitstellen (Geräteausführung noch offen)
- [ ] Raum-IDs und Zuordnungen dauerhaft erhalten; keine erneute manuelle Auswahl bei jedem Start
- [ ] Verfügbarkeit und Grenzen der Raumsteuerung lokal gegenüber Cloud verifizieren

## Phase 3 – Weitere Erweiterungen
- [ ] Zonenreinigung
- [ ] Karten und Reinigungsverlauf
- [ ] Zeitpläne / Wartungsdaten, soweit verfügbar
- [ ] Staubabsaugung und Wartungsreset-Funktionen, soweit sicher verifiziert

## Phase 4 – Qualität und Veröffentlichung
- [x] CI-Build und automatisierte Unit-Tests
- [ ] Integrationstest mit realem Roidmi EVE Plus
- [ ] ioBroker-Repository-Konventionen und Adapter-Validierung
- [ ] Release-Prozess und vollständige Dokumentation

## Phase 5 – Integration
- [ ] Optionale Anbindung an HomePilot

**Wichtiger Statushinweis:** Grüne CI-Läufe bestätigen Build und Unit-Tests, nicht die reale Gerätekommunikation. Start-/Pause-/Fortsetzen-/Dock-Mappings sind anhand veröffentlichter V60-Profile hinterlegt und müssen am konkreten Gerät noch bestätigt werden.
