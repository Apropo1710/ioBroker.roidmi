# Projektplan

## Phase 0 – Gerät und Protokoll validieren
- [ ] Modell/Firmware und lokale Netzwerkadresse erfassen
- [ ] MIoT-/miIO-Token sicher beschaffen und lokal halten
- [ ] Read-only-Verbindung testen
- [ ] Tatsächlich unterstützte Properties, Actions und Fehlercodes dokumentieren
- [ ] Prüfen, welche Funktionen lokal und welche nur über Cloud verfügbar sind

## Phase 1 – Adapterbasis
- [x] TypeScript-Projektgerüst
- [x] Konfigurationsvalidierung als erste isolierte Funktion
- [x] Secret-Redaction-Helfer
- [ ] ioBroker-Adapter-Core integrieren
- [ ] Konfiguration, Verbindungsmanager, Polling und Backoff
- [ ] Objekt-/State-Modell und Tests

## Phase 2 – Kernsteuerung
- [ ] Status und Akkudaten
- [ ] Start / Pause / Fortsetzen / Dock
- [ ] Saugmodus und Wasserstufe
- [ ] Fehler- und Verbindungsstatus

## Phase 3 – Erweiterungen
- [ ] Räume und Zonen
- [ ] Karten und Reinigungsverlauf
- [ ] Zeitpläne / Wartungsdaten, soweit verfügbar

## Phase 4 – Qualität und Veröffentlichung
- [ ] CI und vollständige Tests
- [ ] ioBroker-Repository-Konventionen und Adapter-Validierung
- [ ] Release-Prozess und Dokumentation

## Phase 5 – Integration
- [ ] Optionale Anbindung an HomePilot
