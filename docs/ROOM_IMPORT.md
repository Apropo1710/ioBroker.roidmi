# Room map import

The adapter creates individual room controls from an imported map description. This first implementation is deliberately manual: it does not poll the robot or Xiaomi Cloud for room data.

## Import format

Write a JSON string to `roidmi.0.control.importRooms`:

```json
{
  "mapId": 123456,
  "rooms": [
    { "id": 1, "name": "Kitchen" },
    { "id": 2, "name": "Living room" }
  ]
}
```

Use the Xiaomi map ID and the segment/room IDs belonging to the currently active map. The IDs are not interchangeable with the local miIO header device ID.

## Generated states

- `map.config`: persisted JSON configuration, restored at adapter startup.
- `map.mapId`: active imported map ID.
- `map.roomsJson`: imported room list.
- `rooms.<segmentId>.name`: readable room name.
- `rooms.<segmentId>.clean`: write `true` to start cleaning that room.
- `control.cleanRooms`: existing JSON command for one or multiple room IDs.

Importing an updated list updates names and removes controls for rooms that were present in the previous imported configuration but are no longer present. A room command is one MIoT action; no additional polling is performed.

## Optional Xiaomi Cloud discovery

Xiaomi Cloud access is optional and disabled by default. It downloads the saved map archive and discovers room IDs/names. Local control and normal status polling do not depend on it. Configure the Xiaomi account username, password and region, enable the option, then write `true` to `control.refreshMap`. This is on demand only, not regular polling. The adapter obtains the current map name locally, finds the matching device in the Xiaomi account by its MIoT token and downloads the map archive. The parser extracts room IDs, names, and the map ID directly from the V60 map metadata when present. Digit-only string IDs are normalized to numbers. When a valid map ID is present, the adapter automatically persists the complete room configuration and creates the room-clean buttons. If the archive omits the map ID, rooms remain visible in `map.roomsJson` and the map ID can still be supplied once via `control.importRooms`. The adapter never guesses a map ID from the device DID, map filename, or segment IDs.

The V60 reference implementation in node-xmihome also reads `mapId` from the same `/0` map archive metadata and returns `autoAreaValue` as segment IDs/names. The adapter follows that metadata-based discovery path. Room-cleaning action execution must still be tested against the physical EVE Plus and its firmware.

Xiaomi may require two-factor authentication; open `map.cloudAuthUrl` on a device using the same internet connection, complete verification, then press `control.refreshMap` again. Credentials are encrypted in ioBroker and never logged.

## Saved schedule / room profile inspection

- Write `true` to `roidmi.0.control.refreshTiming` to read the robot's saved schedule JSON once.
- The result is stored in `timing.raw`; `timing.lastUpdate` records when the read succeeded.
- This reads MIoT SIID 8 / PIID 6 and is intentionally not part of the regular polling loop. It adds no background traffic.
- The JSON format can contain schedule start time, enabled flag, fan speed, cleaning type, weekdays, water level, and room IDs. Reading it helps inspect room-specific schedule data, but does not yet prove that the original app's per-room defaults are represented in the same structure.
- Do not write to this property yet: setting it replaces existing schedules on the robot.
