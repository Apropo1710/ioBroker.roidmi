/**
 * RoidmiPilot – adapter entry point.
 *
 * This initial scaffold deliberately does not attempt a device connection.
 * The protocol layer must be validated against the user's physical robot
 * before control commands or polling are enabled.
 */

export interface AdapterLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface AdapterConfig {
  host?: string;
  token?: string;
  pollIntervalSeconds?: number;
}

export function validateConfig(config: AdapterConfig): string[] {
  const errors: string[] = [];

  if (config.host && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(config.host)) {
    errors.push("host must be an IPv4 address");
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

/**
 * Placeholder for the ioBroker adapter bootstrap.
 * The runtime adapter class will be added after the supported ioBroker
 * adapter-core baseline and repository conventions are verified.
 */
export function describeStartup(config: AdapterConfig): string {
  const host = config.host || "not configured";
  return `RoidmiPilot scaffold ready; device host: ${host}`;
}
