# Xiaomi X20+ Integration – Entwicklungsplan

**Zielgerät:** Xiaomi Robot Vacuum X20+  
**MIoT-Modell:** `xiaomi.vacuum.c102gl`  
**Spec:** `urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1`  
**Entwicklungsbranch:** `feature/xiaomi-x20plus`

## Grundregeln

- Die bestehende Roidmi-EVE-Plus-Unterstützung bleibt unangetastet und wird nicht auf Xiaomi-spezifische Befehle umgestellt.
- Xiaomi bekommt ein eigenes Geräteprofil und eine eigene Protokoll-/Mapping-Schicht.
- Erste Tests ausschließlich lesend; Steuerbefehle erst nach verifizierter Statusabfrage.
- Lokalsteuerung und Cloud-Kartenabruf klar trennen.
- Zugangsdaten, Token, Xiaomi-DID und persönliche Karten-/Raumdaten niemals in Git, Tests oder Logs speichern.
- Statuspolling möglichst effizient gestalten; keine überlappenden Zyklen, nur geänderte ioBroker-States schreiben und keine Karte im regelmäßigen Polling abrufen.

## Recherche – Ausgangslage

- Modellkennung `xiaomi.vacuum.c102gl` ist dem X20+ zugeordnet.
- Ein öffentliches, hardwarevalidiertes HA-Projekt für exakt dieses Modell beschreibt lokale MIoT-Steuerung über UDP 54321.
- Die MIoT-Property-/Action-IDs sind modellabhängig. Keine Roidmi V60 SIID/PIID/AIID-Werte übernehmen.
- Bei der referenzierten X20+-Firmware werden Pause/Stop/Dock in dieser Integration ausdrücklich als nicht zuverlässig unterstützt geführt, obwohl sie in der MIoT-Spezifikation vorkommen. Daher keine solche Funktion ohne Live-Test als unterstützt deklarieren.
- Karten-/Raumdaten benötigen bei dieser Firmware einen separaten Xiaomi-Cloud-Weg; die lokale Steuerung kann davon unabhängig bleiben.
- Raumreinigung ist in einer Referenz am Gerät validiert, muss aber unabhängig in unserem Adapter getestet werden.

Referenz:
- https://github.com/ilirdokle43/HA-Xiaomi-Vacuum-Local
- https://home.miot-spec.com/spec?type=urn:miot-spec-v2:device:vacuum:0000A006:xiaomi-c102gl:1

## Vorgehensplan

1. Gerätespezifische MIoT-Services, Properties, Actions und Datenformate aus Spec und hardwarevalidierter Referenz extrahieren.
2. Transport-/Protokollschicht prüfen: vorhandener miIO-Client ist auf Roidmi-Workflow ausgelegt. Nicht davon ausgehen, dass dieser für den X20+ genügt.
3. Ein isoliertes Xiaomi-Modul mit Modellprofil aufbauen, ohne Roidmi-Initialisierung oder Datenpunkte zu verändern.
4. Zunächst nur eine minimale lesende Verbindung und ausgewählte Statuswerte implementieren.
5. Live-Validierung mit X20+ durchführen.
6. Erst danach Steuerbefehle und weitere Statuswerte ergänzen.
7. Cloud-Karte/Räume als getrennte optionale Erweiterung entwickeln.
8. Tests, Build und Distribution auf Feature-Branch prüfen. Erst nach Benutzer-Live-Test und erfolgreicher CI Integration in `main`.

## Benötigte Live-Testdaten (nicht ins Repository eintragen)

Für die erste lokale Verbindung werden später benötigt:
- X20+-IP-Adresse im LAN
- Xiaomi-Geräte-Token des X20+ (32 Zeichen)
- numerische Xiaomi DID des X20+

Diese Werte gehören ausschließlich in die Adapterinstanz-Konfiguration bzw. sichere lokale Testumgebung. Sie dürfen nicht in GitHub-Issues, Screenshots, Commits oder Logs erscheinen.
