export interface AdapterConfig {
    host?: string;
    did?: string;
    token?: string;
    pollIntervalSeconds?: number;
}

/** Validate adapter settings before opening a socket or starting polling. */
export function validateConfig(config: AdapterConfig): string[] {
    const errors: string[] = [];
    if (config.host && !isIPv4Address(config.host)) {
        errors.push("host must be a valid IPv4 address");
    }
    if (config.did && !/^\d{1,20}$/.test(config.did)) {
        errors.push("did must be a numeric Xiaomi device ID");
    }
    if (config.token && !/^[0-9a-fA-F]{32}$/.test(config.token)) {
        errors.push("token must contain exactly 32 hexadecimal characters");
    }
    if (config.pollIntervalSeconds !== undefined &&
        (!Number.isInteger(config.pollIntervalSeconds) ||
         config.pollIntervalSeconds < 5 ||
         config.pollIntervalSeconds > 3600)) {
        errors.push("pollIntervalSeconds must be an integer between 5 and 3600");
    }
    return errors;
}

function isIPv4Address(value: string): boolean {
    const octets = value.split(".");
    return octets.length === 4 && octets.every((octet) =>
        /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255
    );
}

export function redactSecret(value: string | undefined): string {
    return value ? "[REDACTED]" : "";
}

export function describeStartup(config: AdapterConfig): string {
    const host = config.host || "not configured";
    return `Roidmi adapter scaffold ready; device host: ${host}`;
}
