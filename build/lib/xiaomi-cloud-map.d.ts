import { RoidmiMapMetadata } from "./roidmi-map";
export interface XiaomiCloudMapOptions {
    username: string;
    password: string;
    country: string;
    token: string;
    mapName: string;
}
export interface XiaomiCloudMapResult {
    metadata: RoidmiMapMetadata;
    mapName: string;
    deviceId: string;
    userId: string;
}
export interface XiaomiCloudAction {
    did: string;
    siid: number;
    aiid: number;
    in?: unknown[];
}
export interface XiaomiCloudPropertyWrite {
    siid: number;
    piid: number;
    value: unknown;
}
export declare class XiaomiCloudMapClient {
    private readonly cookies;
    private ssecurity;
    private userId;
    private serviceToken;
    private cUserId;
    private passToken;
    private pendingFlag;
    private pendingTrust;
    private maskedDestination;
    private readonly agent;
    hasSession(): boolean;
    exportSession(): string;
    restoreSession(serialized: string): void;
    clearSession(): void;
    callAction(country: string, action: XiaomiCloudAction, onSessionChanged?: () => Promise<void>): Promise<unknown>;
    /** Read MIoT properties through Xiaomi Cloud on explicit request (never part of polling). */
    getProperties(country: string, did: string, properties: Array<{
        siid: number;
        piid: number;
    }>, onSessionChanged?: () => Promise<void>, datasource?: 1 | 2): Promise<unknown>;
    /** Write MIoT properties through Xiaomi Cloud on explicit user request (never part of polling). */
    setProperties(country: string, did: string, properties: XiaomiCloudPropertyWrite[], onSessionChanged?: () => Promise<void>): Promise<unknown>;
    /** Read the newest live map-history frame (MIoT property 6.1), on explicit request only. */
    fetchXiaomiLiveRoomSelection(country: string, did: string, onSessionChanged?: () => Promise<void>): Promise<{
        timestamp: number;
        segmentIds: number[];
    }>;
    /** Read the current miIO tokens of the given devices from the Xiaomi Cloud device list (explicit request only). */
    /** All devices of the signed-in account that report a miIO token (current tokens, DID, model, local IP). */
    fetchCloudDevices(country: string, onSessionChanged?: () => Promise<void>): Promise<CloudDeviceToken[]>;
    /** Fetch the C102GL saved room map from Xiaomi FDS. This is explicit/manual and never part of polling. */
    fetchXiaomiRooms(country: string, did: string, onSessionChanged?: () => Promise<void>): Promise<Array<{
        segmentId: number;
        name: string;
        roomId?: string;
    }>>;
    /**
     * Signs in to the Xiaomi Cloud unless a session exists. The first sign-in usually needs a
     * verification code (e-mail or SMS); the session is then persisted via onSessionChanged.
     */
    signIn(o: {
        username: string;
        password: string;
    }, verificationCode?: string, onProgress?: (message: string) => void, onSessionChanged?: () => Promise<void>): Promise<void>;
    fetchMap(o: XiaomiCloudMapOptions, verificationCode?: string, onProgress?: (message: string) => void, onSessionChanged?: () => Promise<void>): Promise<XiaomiCloudMapResult>;
    private identityCookie;
    private startTwoFactor;
    private finishLogin;
    /**
     * Xiaomi serviceToken is not permanent. Renew it using the long-lived
     * account passToken before falling back to a password/2FA login.
     * This is the same flow used by current Xiaomi cloud integrations.
     */
    private renewSessionWithPassToken;
    private api;
    private request;
    private json;
}
export interface CloudDeviceToken {
    did: string;
    token: string;
    model: string;
    localIp: string;
}
/**
 * Picks the current miIO token for each requested DID from a Xiaomi Cloud
 * home/device_list result. Entries without a valid 32-hex token are ignored.
 */
export declare function parseCloudDevices(list: unknown): CloudDeviceToken[];
/**
 * The robot in the cloud device list: by DID when one is configured, otherwise by its local IP
 * (first setup without a known DID). An IP match must be unambiguous.
 */
export declare function findCloudDevice(devices: CloudDeviceToken[], did: string, ip: string): CloudDeviceToken | undefined;
