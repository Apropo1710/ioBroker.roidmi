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
- Wasserstufe: SIID 8 / PIID 11.
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
