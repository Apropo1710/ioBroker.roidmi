"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVacuumAction = buildVacuumAction;
exports.getActionResponseError = getActionResponseError;
exports.getActionFailureStatus = getActionFailureStatus;
/** Start whole-map cleaning; pause/resume are custom actions; dock uses Battery. */
function buildVacuumAction(command) {
    switch (command) {
        case "start": return { siid: 14, aiid: 1, in: [1, ""] };
        case "pause": return { siid: 8, aiid: 8 };
        case "resume": return { siid: 8, aiid: 5 };
        case "dock": return { siid: 3, aiid: 1 };
        case "stop": return { siid: 2, aiid: 2 };
    }
}
/** Returns an error message for a non-success MIoT action response, if present. */
function getActionResponseError(response) {
    const item = Array.isArray(response) ? response[0] : response;
    if (!item || typeof item !== "object" || !("code" in item))
        return null;
    const code = item.code;
    if (typeof code === "number" && code !== 0)
        return "MIoT action rejected (code " + code + ")";
    return null;
}
/** Classifies command failures without retrying potentially delivered actions. */
function getActionFailureStatus(error, transport) {
    const message = error instanceof Error ? error.message : "Unknown command error";
    const normalized = message.toLowerCase();
    const timedOut = normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("etimedout");
    if (timedOut) {
        return {
            status: transport === "cloud"
                ? "Timeout: Xiaomi Cloud did not confirm the command; outcome unknown (it may have reached the robot)"
                : "Timeout: no MIoT acknowledgement; command outcome unknown (it may have reached the robot)",
            uncertain: true
        };
    }
    if (transport === "cloud" && normalized.includes("session is unavailable")) {
        return { status: "Cloud session unavailable: sign in and complete Xiaomi verification first", uncertain: false };
    }
    return { status: "Failed: " + message, uncertain: false };
}
