export interface AdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
}

export function validateConfig(config: AdapterConfig): string[] {
    const errors: string[] = [];
    if (config.host && !/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(config.host)) {
        errors.push("host must be an IPv4 address");
    }
    if (config.did && !/^\\d{1,20}$/.test(config.did)) {
        errors.push("did must be a numeric Xiaomi device ID");
    }
    if (config.pollIntervalSeconds !== undefined &&
        (!Number.isInteger(config.pollIntervalSeconds) ||
         config.pollIntervalSeconds < 5 ||
         config.pollIntervalSeconds > 3600)) {
        errors.push("pollIntervalSeconds must be an integer between 5 and 3600");
    }
    return errors;
}

export function redactSecret(value: string | undefined): string {
    return value ? "[REDACTED]" : "";
}

export function describeStartup(config: AdapterConfig): string {
    const host = config.host || "not configured";
    return `Roidmi adapter scaffold ready; device host: ${host}`;
}
