# Projektplan

## Phase 0 – Gerät und Protokoll validieren
- [ ] Modell/Firmware und lokale Netzwerkadresse erfassen
- [ ] MIoT-/miIO-Token sicher beschaffen und lokal halten
- [ ] Read-only-Verbindung testen
- [ ] Tatsächlich unterstützte Properties, Actions, Raum-IDs und Fehlercodes am Gerät dokumentieren
- [x] Dokumentiertes MIoT-Format für Einzel- und Mehrraumreinigung als getesteten Payload-Builder abbilden
- [ ] Prüfen, welche Funktionen lokal und welche nur über Cloud verfügbar sind

## Phase 1 – Adapterbasis
- [x] TypeScript-Projektgerüst
- [x] Konfigurationsvalidierung als erste isolierte Funktion
- [x] Secret-Redaction-Helfer
- [x] ioBroker-Adapter-Core integrieren
- [x] Konfiguration, Verbindungsmanager, Polling und Backoff
- [x] Basis-Objekt-/State-Modell und Tests

## Phase 2 – Kernsteuerung (inkl. priorisierter Raumsteuerung)
- [ ] Status und Akkudaten
- [ ] Start / Pause / Fortsetzen / Dock
- [ ] Saugmodus und Wasserstufe
- [ ] Fehler- und Verbindungsstatus
- [ ] Raumaufteilung bzw. Raumliste vom Gerät abrufen, soweit das Protokoll es ermöglicht
- [ ] Aktuelle mapId und Raum-/Segment-IDs automatisch ermitteln und persistent ablegen
- [ ] Räume mit stabilen Raum-IDs und lesbaren Namen als ioBroker-Objekte abbilden
- [ ] Reinigung eines einzelnen ausgewählten Raums starten
- [ ] Reinigung mehrerer ausgewählter Räume in einem Auftrag starten
- [ ] Raum-IDs und Zuordnungen dauerhaft erhalten; keine erneute manuelle Auswahl bei jedem Start
- [ ] Verfügbarkeit und Grenzen der Raumsteuerung lokal gegenüber Cloud verifizieren

## Phase 3 – Weitere Erweiterungen
- [ ] Zonenreinigung
- [ ] Karten und Reinigungsverlauf
- [ ] Zeitpläne / Wartungsdaten, soweit verfügbar

## Phase 4 – Qualität und Veröffentlichung
- [ ] CI und vollständige Tests
- [ ] ioBroker-Repository-Konventionen und Adapter-Validierung
- [ ] Release-Prozess und Dokumentation

## Phase 5 – Integration
- [ ] Optionale Anbindung an HomePilot
