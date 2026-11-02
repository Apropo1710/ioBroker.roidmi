/** Verified Roidmi V60 MIoT action mappings. */
export interface VacuumAction {
    siid: number;
    aiid: number;
    in?: unknown[];
}
export type VacuumCommand = "start" | "pause" | "resume" | "dock" | "stop";
/** Start whole-map cleaning; pause/resume are custom actions; dock uses Battery. */
export declare function buildVacuumAction(command: VacuumCommand): VacuumAction;
/** Returns an error message for a non-success MIoT action response, if present. */
export declare function getActionResponseError(response: unknown): string | null;
