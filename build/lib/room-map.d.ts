/** Validated, persistable room-map import format for the Roidmi EVE Plus. */
export interface RoomMapEntry {
    id: number;
    name: string;
}
export interface RoomMapConfig {
    mapId: number;
    rooms: RoomMapEntry[];
}
/**
 * Parse JSON supplied to control.importRooms.
 * Example: {"mapId":123456,"rooms":[{"id":1,"name":"Kitchen"},{"id":2,"name":"Living room"}]}
 */
export declare function parseRoomMapConfig(value: string): RoomMapConfig;
