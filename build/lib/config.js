"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRoidmiEnabled = isRoidmiEnabled;
exports.isXiaomiEnabled = isXiaomiEnabled;
exports.validateRoidmiConfig = validateRoidmiConfig;
exports.validateXiaomiConfig = validateXiaomiConfig;
exports.validateConfig = validateConfig;
exports.redactSecret = redactSecret;
exports.describeStartup = describeStartup;
const TOKEN_RE = /^[0-9a-fA-F]{32}$/;
const DID_RE = /^\d{1,20}$/;
/** Old adapter instances have no enable switches and should continue to use Roidmi. */
function isRoidmiEnabled(config) {
    return config.enableRoidmi !== false;
}
function isXiaomiEnabled(config) {
    return config.enableXiaomi === true;
}
function validateRoidmiConfig(config) {
    const errors = [];
    if (!config.host || !isIPv4Address(config.host))
        errors.push("Roidmi host must be a valid IPv4 address");
    if (!config.did || !DID_RE.test(config.did))
        errors.push("Roidmi DID must be a numeric device ID");
    if (!config.token || !TOKEN_RE.test(config.token))
        errors.push("Roidmi token must contain exactly 32 hexadecimal characters");
    return errors;
}
function validateXiaomiConfig(config) {
    const errors = [];
    if (!config.xiaomiHost || !isIPv4Address(config.xiaomiHost))
        errors.push("Xiaomi X20+ host must be a valid IPv4 address");
    if (!config.xiaomiDid || !DID_RE.test(config.xiaomiDid))
        errors.push("Xiaomi X20+ DID must be a numeric device ID");
    if (!config.xiaomiToken || !TOKEN_RE.test(config.xiaomiToken))
        errors.push("Xiaomi X20+ token must contain exactly 32 hexadecimal characters");
    return errors;
}
/** Validate global settings and enabled-device selection, not each robot's credentials. */
function validateConfig(config) {
    const errors = [];
    if (!isRoidmiEnabled(config) && !isXiaomiEnabled(config)) {
        errors.push("Enable at least one robot (Roidmi EVE Plus or Xiaomi X20+).");
    }
    if (config.pollIntervalSeconds !== undefined &&
        (!Number.isInteger(config.pollIntervalSeconds) || config.pollIntervalSeconds < 5 || config.pollIntervalSeconds > 3600)) {
        errors.push("pollIntervalSeconds must be an integer between 5 and 3600");
    }
    return errors;
}
function isIPv4Address(value) {
    const octets = value.split(".");
    return octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255);
}
function redactSecret(value) {
    return value ? "[REDACTED]" : "";
}
function describeStartup(config) {
    const host = config.host || "not configured";
    return `Roidmi adapter scaffold ready; device host: ${host}`;
}
