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
export declare class XiaomiCloudMapClient {
    private readonly cookies;
    private ssecurity;
    private userId;
    private serviceToken;
    private readonly agent;
    fetchMap(o: XiaomiCloudMapOptions): Promise<XiaomiCloudMapResult>;
    private api;
    private request;
    private json;
}
