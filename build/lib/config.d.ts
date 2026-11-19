export interface AdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
    enableRoidmi?: boolean;
    enableXiaomi?: boolean;
    xiaomiHost?: string;
    xiaomiDid?: string;
    xiaomiToken?: string;
}
/** Old adapter instances have no enable switches and should continue to use Roidmi. */
export declare function isRoidmiEnabled(config: AdapterConfig): boolean;
export declare function isXiaomiEnabled(config: AdapterConfig): boolean;
export declare function validateRoidmiConfig(config: AdapterConfig): string[];
export declare function validateXiaomiConfig(config: AdapterConfig): string[];
/** Validate global settings and enabled-device selection, not each robot's credentials. */
export declare function validateConfig(config: AdapterConfig): string[];
export declare function redactSecret(value: string | undefined): string;
export declare function describeStartup(config: AdapterConfig): string;
