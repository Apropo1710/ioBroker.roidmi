export interface XiaomiDreameRoom {
    segmentId: number;
    name: string;
    roomId?: string;
}
/** Decode the active-room selection (sa) from a live C102GL map-history frame. */
export declare function parseXiaomiLiveMapSelection(value: string): number[];
/** Decode C102GL FDS saved-map room metadata. This parser is separate from the EVE Plus map parser. */
export declare function parseXiaomiDreameFdsMap(body: Buffer | string, suffix: string): XiaomiDreameRoom[];
/** Keep only segments explicitly assigned to a Xiaomi Home room; outdoor/window phantom segments lack roomID. */
export declare function filterXiaomiHomeRooms(rooms: XiaomiDreameRoom[]): XiaomiDreameRoom[];
/** Extract the FDS object announcement (object path + per-object suffix) from MIoT 6.3 history. */
export declare function parseXiaomiFdsAnnouncement(value: unknown): {
    objectName: string;
    suffix: string;
};
