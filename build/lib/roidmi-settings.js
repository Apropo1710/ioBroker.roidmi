"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoidmiSetting = getRoidmiSetting;
exports.buildSettingWrite = buildSettingWrite;
const SETTINGS = {
    fanSpeed: { siid: 2, piid: 4, min: 0, max: 4 },
    sweepType: { siid: 2, piid: 8, min: 0, max: 2 },
    waterLevel: { siid: 8, piid: 11, min: 0, max: 4 }
};
function getRoidmiSetting(id) {
    const setting = SETTINGS[id];
    return setting ? { ...setting } : undefined;
}
function buildSettingWrite(did, id, value) {
    if (!/^\d+$/.test(did))
        throw new Error("DID must be numeric");
    const setting = getRoidmiSetting(id);
    if (!setting)
        throw new Error("Unknown Roidmi setting");
    if (typeof value !== "number" || !Number.isInteger(value) || value < setting.min || value > setting.max) {
        throw new Error(`Value for ${id} must be an integer between ${setting.min} and ${setting.max}`);
    }
    return {
        method: "set_properties",
        params: [{ did, siid: setting.siid, piid: setting.piid, value }]
    };
}
