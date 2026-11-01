/** Writable Roidmi EVE Plus MIoT properties and their supported numeric values. */
export interface RoidmiSetting {
    siid: number;
    piid: number;
    min: number;
    max: number;
}
export declare function getRoidmiSetting(id: string): RoidmiSetting | undefined;
export declare function buildSettingWrite(did: string, id: string, value: unknown): {
    method: "set_properties";
    params: [{
        did: string;
        siid: number;
        piid: number;
        value: number;
    }];
};
