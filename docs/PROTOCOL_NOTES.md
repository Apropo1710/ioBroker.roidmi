# Protokollnotizen

## Gerätekennung und MIoT
- Bekannte Gerätekennung: `roidmi.vacuum.v60` (Roidmi EVE Plus).
- MIoT / miIO ist der vorrangige technische Untersuchungsansatz.
- `python-miio` enthält eine Referenzimplementierung für Roidmi-MIoT-Geräte; sie dient nur als Protokollreferenz, nicht als Laufzeitabhängigkeit.

## Raumreinigung – konkretes MIoT-Aktionsformat
Mehrere Berichte und Home-Assistant-Beispiele für den EVE Plus dokumentieren:
- MIoT Service-ID (siid): `14`
- Action-ID (aiid): `1`
- Eingabeparameter: `[2, JSON.stringify({ mapId, segmentId: [roomId, ...] })]`
- Beispiel: `[2, "{\\"mapId\\":1627839123,\\"segmentId\\":[3]}"]`
- Mehrere Räume werden als mehrere IDs in demselben `segmentId`-Array übergeben.

Quellen:
- https://community.home-assistant.io/t/roidmi-eva-integration/450084
- https://community.home-assistant.io/t/xiaomi-eve-plus-integration/271830
- https://github.com/poisondima/Roidmi-EVE-Plus

**Wichtige Einschränkung:** Ältere Berichte deuten darauf hin, dass Segmentreinigung bei manchen Setups nur über Xiaomi-Cloud funktioniert und lokal mit Timeout scheitert. Die lokale Ausführbarkeit ist daher noch `unknown`, bis sie am konkreten Gerät getestet wurde.

## Raum- und Karteninformationen
- `mapId` sowie Raum-/Segment-IDs müssen aus der aktuellen Karte bzw. Geräte-/Cloudantwort ermittelt werden.
- Raum-IDs müssen den realen Segment-IDs des Roboters entsprechen.
- Kartenextraktion kann über Xiaomi Cloud Map Extractor funktionieren, ist aber eine mögliche Cloud-Abhängigkeit und nicht gleichbedeutend mit lokaler Steuerung.

## Weitere Rechercheansätze
- `python-miio` enthält Referenzimplementierungen für Status und MIoT-Eigenschaften.
- Karten-/Verlaufsfunktionen können je nach Firmware und Cloud-Abhängigkeit eingeschränkt sein.

## Sicherheitsregeln
- Token niemals in Git, Screenshots oder ungeschützte Logs übernehmen.
- Bei Debug-Ausgaben Payloads mit Authentifizierungsdaten redigieren.
- Erste Gerätetests ausschließlich lesend durchführen.
