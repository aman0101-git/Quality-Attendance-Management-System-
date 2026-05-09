/**
 * App-side scorecard status. Mirrors the underlying `isActive` boolean
 * column but exposed as a friendlier ACTIVE/INACTIVE label in the API.
 */
export const ScorecardStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type ScorecardStatus =
  (typeof ScorecardStatus)[keyof typeof ScorecardStatus];

export function statusToBoolean(status: ScorecardStatus): boolean {
  return status === ScorecardStatus.ACTIVE;
}

export function booleanToStatus(isActive: boolean): ScorecardStatus {
  return isActive ? ScorecardStatus.ACTIVE : ScorecardStatus.INACTIVE;
}
