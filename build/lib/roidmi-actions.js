"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVacuumAction = buildVacuumAction;
exports.getActionResponseError = getActionResponseError;
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
    if (!Array.isArray(response))
        return null;
    const item = response[0];
    if (!item || typeof item !== "object" || !("code" in item))
        return null;
    const code = item.code;
    if (typeof code === "number" && code !== 0)
        return "MIoT action rejected (code " + code + ")";
    return null;
}
