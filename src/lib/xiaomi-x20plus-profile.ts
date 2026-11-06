/**
 * Xiaomi Robot Vacuum X20+ (xiaomi.vacuum.c102gl) MIoT profile.
 *
 * This profile is deliberately separate from the Roidmi EVE Plus mapping.
 * Values are taken from the C102GL model-specific reference integration and
 * remain provisional until verified against the user's physical X20+.
 *
 * Do not reuse these SIID/PIID/AIID values for other Xiaomi/Dreame models.
 */
export const XIAOMI_X20_PLUS_MODEL = "xiaomi.vacuum.c102gl";

export interface MiotPropertyRef {
    readonly siid: number;
    readonly piid: number;
}

/**
 * Core state is polled every 30s; maintenance properties are polled every 5min.
 */
export const XIAOMI_X20_PLUS_CONSUMABLE_PROPERTIES = {
    mainBrushLeft: { siid: 9, piid: 1 },
    mainBrushLife: { siid: 9, piid: 2 },
    sideBrushLeft: { siid: 10, piid: 1 },
    sideBrushLife: { siid: 10, piid: 2 },
    filterLife: { siid: 11, piid: 1 },
    filterLeft: { siid: 11, piid: 2 },
    mopLife: { siid: 18, piid: 1 },
    mopLeft: { siid: 18, piid: 2 }
} as const satisfies Record<string, MiotPropertyRef>;

export const XIAOMI_X20_PLUS_CONSUMABLE_POLL_INTERVAL_MS = 300000;
export const XIAOMI_X20_PLUS_PROPERTIES = {
    status: { siid: 2, piid: 1 },
    fault: { siid: 2, piid: 2 },
    suction: { siid: 2, piid: 3 },
    battery: { siid: 3, piid: 1 },
    chargingState: { siid: 3, piid: 2 },
    cleaningTime: { siid: 4, piid: 2 },
    cleaningArea: { siid: 4, piid: 3 },
    cleaningMode: { siid: 4, piid: 4 },
    mopMode: { siid: 4, piid: 5 },
    waterboxStatus: { siid: 4, piid: 6 },
    taskStatus: { siid: 4, piid: 7 },
    dryLeftTime: { siid: 2, piid: 5 },
    workMode: { siid: 4, piid: 1 }
} as const satisfies Record<string, MiotPropertyRef>;

/** Firmware status enum from the hardware-validated C102GL reference profile.
 * Status 13 (Charging complete) is also confirmed by the user's live X20+ data.
 */
export const XIAOMI_X20_PLUS_STATUS: Readonly<Record<number, string>> = {
    1: "Saugen",
    2: "Bereit",
    3: "Pausiert",
    4: "Fehler",
    5: "Fährt zur Station",
    6: "Lädt",
    7: "Wischen",
    8: "Trocknet",
    9: "Mopps werden gewaschen",
    10: "Fährt zum Waschen",
    11: "Kartierung",
    12: "Saugen und Wischen",
    13: "Ladung abgeschlossen",
    14: "Firmware-Update",
    19: "Wasserprüfung",
    21: "Waschen pausiert",
    22: "Staubbehälter wird entleert",
    23: "Fernsteuerung"
};

export function getXiaomiX20PlusStatusText(status: number): string {
    return XIAOMI_X20_PLUS_STATUS[status] ?? `Unbekannter Xiaomi-Status (${status})`;
}
