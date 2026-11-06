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

/** Validate only enabled robot settings; legacy configs keep Roidmi enabled by default. */
export function validateConfig(config: AdapterConfig): string[] {
    const errors: string[] = [];
    const roidmiEnabled = config.enableRoidmi !== false;
    const xiaomiEnabled = config.enableXiaomi === true;

    if (!roidmiEnabled && !xiaomiEnabled) {
        errors.push("Enable at least one robot (Roidmi EVE Plus or Xiaomi X20+).");
    }
    if (roidmiEnabled) {
        if (!config.host || !isIPv4Address(config.host)) errors.push("Roidmi host must be a valid IPv4 address");
        if (!config.did || !/^\\d{1,20}$/.test(config.did)) errors.push("Roidmi DID must be a numeric Xiaomi device ID");
        if (!config.token || !/^[0-9a-fA-F]{32}$/.test(config.token)) errors.push("Roidmi token must contain exactly 32 hexadecimal characters");
    }
    if (xiaomiEnabled) {
        if (!config.xiaomiHost || !isIPv4Address(config.xiaomiHost)) errors.push("Xiaomi X20+ host must be a valid IPv4 address");
        if (!config.xiaomiDid || !/^\\d{1,20}$/.test(config.xiaomiDid)) errors.push("Xiaomi X20+ DID must be a numeric device ID");
        if (!config.xiaomiToken || !/^[0-9a-fA-F]{32}$/.test(config.xiaomiToken)) errors.push("Xiaomi X20+ token must contain exactly 32 hexadecimal characters");
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
        /^\\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255
    );
}

export function redactSecret(value: string | undefined): string {
    return value ? "[REDACTED]" : "";
}

export function describeStartup(config: AdapterConfig): string {
    const host = config.host || "not configured";
    return `Roidmi adapter scaffold ready; device host: ${host}`;
}
