export interface MiioHeader {
    deviceId: number;
    stamp: number;
}
export declare function buildHandshakePacket(): Buffer;
export declare function parseMiioHeader(packet: Buffer): MiioHeader;
export declare function buildMiioRequest(method: string, params: unknown[], id: number, tokenHex: string, header: MiioHeader): Buffer;
export declare function parseMiioResponse(packet: Buffer, tokenHex: string): unknown;
