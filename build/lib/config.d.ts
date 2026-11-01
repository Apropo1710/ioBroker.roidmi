export interface AdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
}
/** Validate adapter settings before opening a socket or starting polling. */
export declare function validateConfig(config: AdapterConfig): string[];
export declare function redactSecret(value: string | undefined): string;
export declare function describeStartup(config: AdapterConfig): string;
