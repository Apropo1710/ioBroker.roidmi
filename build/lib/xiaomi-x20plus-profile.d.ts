/**
 * Xiaomi Robot Vacuum X20+ (xiaomi.vacuum.c102gl) MIoT profile.
 *
 * This profile is deliberately separate from the Roidmi EVE Plus mapping.
 * Values are taken from the C102GL model-specific reference integration and
 * remain provisional until verified against the user's physical X20+.
 *
 * Do not reuse these SIID/PIID/AIID values for other Xiaomi/Dreame models.
 */
export declare const XIAOMI_X20_PLUS_MODEL = "xiaomi.vacuum.c102gl";
export interface MiotPropertyRef {
    readonly siid: number;
    readonly piid: number;
    readonly mask?: number;
}
/**
 * Consumables are polled every 5 minutes to reduce device traffic.
 */
export declare const XIAOMI_X20_PLUS_CONSUMABLE_PROPERTIES: {
    readonly mainBrushLeft: {
        readonly siid: 9;
        readonly piid: 1;
    };
    readonly mainBrushLife: {
        readonly siid: 9;
        readonly piid: 2;
    };
    readonly sideBrushLeft: {
        readonly siid: 10;
        readonly piid: 1;
    };
    readonly sideBrushLife: {
        readonly siid: 10;
        readonly piid: 2;
    };
    readonly filterLife: {
        readonly siid: 11;
        readonly piid: 1;
    };
    readonly filterLeft: {
        readonly siid: 11;
        readonly piid: 2;
    };
    readonly mopLife: {
        readonly siid: 18;
        readonly piid: 1;
    };
    readonly mopLeft: {
        readonly siid: 18;
        readonly piid: 2;
    };
};
export declare const XIAOMI_X20_PLUS_CONSUMABLE_POLL_INTERVAL_MS = 300000;
/** Optional C102GL settings; specification-based, not verified on user's firmware. */
export declare const XIAOMI_X20_PLUS_OPTIONAL_SETTINGS: {
    readonly childLock: {
        readonly siid: 4;
        readonly piid: 27;
    };
    readonly carpetBoost: {
        readonly siid: 4;
        readonly piid: 12;
    };
    readonly resumeAfterCharging: {
        readonly siid: 4;
        readonly piid: 11;
    };
};
export declare const XIAOMI_X20_PLUS_LIFETIME_PROPERTIES: {
    readonly firstClean: {
        readonly siid: 12;
        readonly piid: 1;
    };
    readonly totalCleaningTime: {
        readonly siid: 12;
        readonly piid: 2;
    };
    readonly totalCleaningCount: {
        readonly siid: 12;
        readonly piid: 3;
    };
    readonly totalCleaningArea: {
        readonly siid: 12;
        readonly piid: 4;
    };
};
export declare const XIAOMI_X20_PLUS_PROPERTIES: {
    readonly vacuumState: {
        readonly siid: 2;
        readonly piid: 1;
    };
    readonly fault: {
        readonly siid: 2;
        readonly piid: 2;
    };
    readonly suction: {
        readonly siid: 2;
        readonly piid: 3;
    };
    readonly battery: {
        readonly siid: 3;
        readonly piid: 1;
    };
    readonly chargingState: {
        readonly siid: 3;
        readonly piid: 2;
    };
    readonly cleaningTime: {
        readonly siid: 4;
        readonly piid: 2;
    };
    readonly cleaningArea: {
        readonly siid: 4;
        readonly piid: 3;
    };
    readonly cleaningMode: {
        readonly siid: 4;
        readonly piid: 23;
        readonly mask: 3;
    };
    readonly waterboxStatus: {
        readonly siid: 4;
        readonly piid: 6;
    };
    readonly taskStatus: {
        readonly siid: 4;
        readonly piid: 7;
    };
    readonly dryLeftTime: {
        readonly siid: 2;
        readonly piid: 5;
    };
    readonly workMode: {
        readonly siid: 4;
        readonly piid: 1;
    };
};
/** Firmware status enum from the hardware-validated C102GL reference profile.
 * Status 13 (Charging complete) is also confirmed by the user's live X20+ data.
 */
export declare const XIAOMI_X20_PLUS_STATUS: Readonly<Record<number, string>>;
export declare function getXiaomiX20PlusStatusText(status: number): string;
