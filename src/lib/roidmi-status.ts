/** Empirical Roidmi EVE Plus status labels. Unknown values remain explicit. */
export function getVacuumStateText(state: number): string {
 switch (state) {
 case 1: return "Standby (observed)"; case 3: return "Paused / suspended (observed)";
 case 4: return "Cleaning (observed)"; case 5: return "Returning to dock (observed, provisional)";
 case 6: return "Docked / post-docking phase (observed, provisional)"; case 9: return "Docked / fully charged state (observed)";
 default: return "Unknown state (" + state + ")"; }
}
export function getChargingStateText(charging: number): string {
 switch (charging) { case 1: return "Dock/charging status 1 (meaning not yet confirmed)";
 case 2: return "Charging status 2 (meaning not confirmed)"; default: return "Unknown charging status (" + charging + ")"; }
}

/** Roidmi V60/EVE Plus fault codes from the MIoT specification. */
export function getRoidmiErrorText(code: number): string {
    switch (code) {
        case 0: return "No error";
        case 1: return "Low battery; returning to dock";
        case 2: return "Low battery; shutting down";
        case 3: return "Main wheel may be stuck";
        case 4: return "Edge sensor needs checking";
        case 5: return "Robot is tilted";
        case 6: return "Lidar may be blocked";
        case 7: return "Front collision sensor needs cleaning";
        case 8: return "Right wall sensor needs cleaning";
        case 9: return "Main brush may be stuck";
        case 10: return "Side brush may be stuck";
        case 11: return "Fan error";
        case 12: return "Lidar cover may be stuck";
        case 13: return "Clean dust box and filter";
        case 14: return "Dust box is missing";
        case 15: return "Clean the removed dust box and filter";
        case 16: return "Robot is trapped";
        case 17: return "Robot must be on the floor to start";
        case 18: return "Water tank is removed";
        case 19: return "Water level is too low";
        case 20: return "Target area is unreachable";
        case 21: return "Robot is in a restricted area";
        case 22: return "Move robot away from cliff edge";
        case 23: return "Water pump current error";
        case 24: return "Failed to return to dock";
        case 25: return "Water pump circuit is open";
        default: return "Unknown error code (" + code + ")";
    }
}
