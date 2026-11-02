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
