/**
 * Parser for the Roidmi V60 compressed map payload.
 *
 * Xiaomi Cloud Map Extractor documents a gzip payload with a 16-byte prefix,
 * a raster section terminated by 0x7f 0x7b, then JSON map metadata.
 * Room IDs and names are supplied by autoArea (or autoAreaValue).
 */
export interface RoidmiMapRoom {
    id: number;
    name: string;
    x?: number;
    y?: number;
    /** Room-specific cleaning profile fields supplied by Xiaomi's map metadata. */
    fanLevel?: number;
    waterPump?: number;
    cleanOrder?: number;
}
export interface RoidmiMapMetadata {
    width: number;
    height: number;
    resolution: number;
    mapId?: number;
    xMin?: number;
    yMin?: number;
    rooms: RoidmiMapRoom[];
}
export declare function parseRoidmiMapPayload(payload: Uint8Array): RoidmiMapMetadata;
/** Decompresses a Xiaomi Cloud Map Extractor-compatible Roidmi .gz archive and parses its metadata. */
export declare function parseRoidmiMapArchive(archive: Uint8Array): RoidmiMapMetadata;
