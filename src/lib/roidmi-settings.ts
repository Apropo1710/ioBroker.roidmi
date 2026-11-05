/** Writable Roidmi EVE Plus MIoT properties and their supported numeric values. */
export interface RoidmiSetting {
    siid: number;
    piid: number;
    min: number;
    max: number;
}

const SETTINGS: Record<string, RoidmiSetting> = {
    fanSpeed: { siid: 2, piid: 4, min: 0, max: 4 },
    waterLevel: { siid: 8, piid: 11, min: 0, max: 4 },
    customizeRooms: { siid: 13, piid: 7, min: 0, max: 1 },
    doubleClean: { siid: 8, piid: 20, min: 0, max: 1 },
    moppingPath: { siid: 13, piid: 8, min: 0, max: 2 }
};

export function getRoidmiSetting(id: string): RoidmiSetting | undefined {
    const setting = SETTINGS[id];
    return setting ? { ...setting } : undefined;
}

export function buildSettingWrite(did: string, id: string, value: unknown): { method: "set_properties"; params: [{ did: string; siid: number; piid: number; value: number }] } {
    if (!/^\d+$/.test(did)) throw new Error("DID must be numeric");
    const setting = getRoidmiSetting(id);
    if (!setting) throw new Error("Unknown Roidmi setting");
    if (typeof value !== "number" || !Number.isInteger(value) || value < setting.min || value > setting.max) {
        throw new Error(`Value for ${id} must be an integer between ${setting.min} and ${setting.max}`);
    }
    return {
        method: "set_properties",
        params: [{ did, siid: setting.siid, piid: setting.piid, value }]
    };
}
