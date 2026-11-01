# Protokollnotizen

## Gerätekennung und MIoT
- Bekannte Gerätekennung: `roidmi.vacuum.v60` (Roidmi EVE Plus).
- MIoT-Aufrufe benötigen die numerische Xiaomi-Gerätekennung `did` (Mi Home device ID); sie ist nicht mit der lokalen miIO-Header-Device-ID gleichzusetzen.
- Die Adapterkonfiguration enthält deshalb ein eigenes DID-Feld. Es wird nicht aus der lokalen Handshake-Antwort geraten.
- MIoT / miIO ist der vorrangige technische Untersuchungsansatz.
- `python-miio` und Home Assistant / openHAB dienen als Protokollreferenzen, nicht als Laufzeitabhängigkeiten.

## Raumreinigung
- MIoT Service-ID (siid): `14`
- Action-ID (aiid): `1`
- Eingabeparameter: `[2, JSON.stringify({ mapId, segmentId: [roomId, ...] })]`
- Mehrere Räume werden als mehrere IDs in demselben `segmentId`-Array übergeben.
- `did` ist die numerische Xiaomi-Gerätekennung; `mapId` stammt aus der aktiven Xiaomi-Karte.
- Die Raumreinigungs-Payload ist implementiert, aber Ausführung und mapId-/Raumermittlung sind am realen Gerät noch nicht validiert.

Quellen:
- https://community.home-assistant.io/t/roidmi-eva-integration/450084
- https://community.home-assistant.io/t/xiaomi-eve-plus-integration/271830
- https://github.com/poisondima/Roidmi-EVE-Plus

## MIoT-Aktionen
Die V60-Referenzprofile listen unter anderem:
- Start Reinigung: SIID 2 / AIID 1
- Pause: SIID 8 / AIID 8
- Fortsetzen: SIID 8 / AIID 5
- Rückkehr/Ladefunktion: SIID 8 / AIID 9 (als herstellerspezifische Aktion geführt)

Diese IDs sind Profil-/Quellenwerte und noch nicht mit dem konkreten EVE-Plus-Gerät und seiner Firmware getestet. Vor produktiver Nutzung muss die Antwort am Gerät geprüft werden.

## Raum- und Karteninformationen
- `mapId` sowie Raum-/Segment-IDs müssen aus der aktuellen Karte bzw. Geräte-/Cloudantwort ermittelt werden.
- Die Kartenextraktion kann über Xiaomi Cloud Map Extractor funktionieren, ist aber eine mögliche Cloud-Abhängigkeit und nicht gleichbedeutend mit lokaler Steuerung.
- Die Parser-Unterstützung für das gzip-Archiv ist vorhanden; automatische Kartenbeschaffung und sichere Auflösung der aktiven mapId bleiben offen.

## Sicherheit und Last
- Token niemals in Git, Screenshots oder ungeschützte Logs übernehmen.
- Erste Gerätetests ausschließlich lesend durchführen.
- Der Adapter liest im konservativen V60-Profil eine Property je RPC, ohne überlappende Pollzyklen.
- Zustände werden nur bei Änderung geschrieben; bei Fehlern greift exponentieller Backoff.
- Karten und Verlauf nur bei Bedarf abrufen, nicht im schnellen Status-Poll.

## Weitere Rechercheansätze
- `python-miio`, Home Assistant und openHAB liefern Referenzprofile für weitere Eigenschaften und Aktionen.
- Lokale und Cloud-Funktionen müssen getrennt ausgewiesen werden.
