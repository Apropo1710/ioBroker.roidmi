# Räume laden und reinigen

Beide Roboter beziehen ihre Raumliste aus der gespeicherten Karte im Xiaomi-Konto. Dafür muss die Xiaomi-Cloud-Anmeldung in den Instanzeinstellungen einmal erfolgreich durchgeführt sein. Karten werden nur auf ausdrückliche Anforderung geladen, nie im normalen Polling.

## Roidmi EVE Plus

### Räume laden

`roidmi.0.evePlus.control.refreshMap` auf `true` setzen. Der Adapter lädt das Kartenarchiv aus der Cloud und legt an:

- `evePlus.map.roomsJson` – Raumliste
- `evePlus.map.mapId` – Karten-ID für die Raumreinigung
- `evePlus.map.config` – gespeicherte Konfiguration, wird beim Adapterstart wiederhergestellt
- `evePlus.map.roomProfilesJson` – Raumprofile aus der Karte (Saugstärke, Wasser, Reihenfolge; nur lesend)
- `evePlus.rooms.<segmentId>.name`, `.clean` und `.profile.*` je Raum

Fehlt im Kartenarchiv die separate Reinigungs-`mapId`, meldet `evePlus.map.cloudStatus` das. Dann die Raumliste einmalig manuell mit der richtigen `mapId` importieren (siehe unten).

### Manueller Import (Fallback)

JSON nach `roidmi.0.evePlus.control.importRooms` schreiben:

```json
{
  "mapId": 123456,
  "rooms": [
    { "id": 1, "name": "Küche" },
    { "id": 2, "name": "Wohnzimmer" }
  ]
}
```

Ein erneuter Import aktualisiert die Namen und entfernt Räume, die nicht mehr enthalten sind.

### Reinigen

- Einzelner Raum: `evePlus.rooms.<segmentId>.clean` auf `true` setzen.
- Mehrere Räume in einem Auftrag: `evePlus.control.cleanRooms` mit `{"mapId":123456,"roomIds":[1,3]}`.

Beides ist eine einzelne MIoT-Aktion (SIID 14 / AIID 1). Der Roboter verwendet die in der Original-App hinterlegten Raumprofile.

## Xiaomi X20+

### Räume laden

`roidmi.0.x20Plus.control.refreshRooms` auf `true` setzen. Ergebnis:

- `x20Plus.rooms.roomsJson` – Raumliste mit Segment-IDs und Namen
- `x20Plus.rooms.mapStatus`, `x20Plus.rooms.lastUpdate`

Wichtig: Maßgeblich ist die **Segment-ID** aus `roomsJson`, nicht die Beschriftung auf der Karte in Xiaomi Home (z. B. „Raum 5“).

### Reinigen

JSON nach `roidmi.0.x20Plus.control.cleanRooms` schreiben:

```json
{ "rooms": [ { "segmentId": 1 }, { "segmentId": 4 }, { "segmentId": 2 } ] }
```

Optional je Raum: `repeat` (1–3), `suction` (0–3), `water` (1–3).

Ablauf im Adapter:

1. Die gewünschte Reinigungsart aus `x20Plus.control.cleaningMode` wird gesetzt und zurückgelesen. Stimmt sie nicht, wird abgebrochen.
2. Danach wird die Raumaktion gesendet (lokal, SIID 4 / AIID 1, mit frischem Handshake).
3. Ergebnis bzw. Fehler steht in `x20Plus.control.cleanRoomsStatus`; `cleanRooms` wird nach der Verarbeitung geleert.

Die Raumreinigung wird nicht automatisch wiederholt, weil ein zweiter Versand eine bereits gestartete Reinigung doppelt auslösen könnte.
