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

## Important limitation

The adapter does not yet discover map IDs or room IDs automatically. Obtain them from a supported map export / Xiaomi Cloud Map Extractor or Mi Home diagnostic data, then import them here. Room-cleaning action execution must still be tested against the physical EVE Plus and its firmware.
