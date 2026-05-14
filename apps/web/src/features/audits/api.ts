import { api } from "@/services/api";
import type { AuditDetail, AuditListItem, AuditStatus } from "./types";

export interface CreateAuditPayload {
  agentId: string;
  projectId: number;
  callReference: string;
  /** Optional — ISO date string (YYYY-MM-DD) or full ISO timestamp. */
  callDate?: string | null;
  /** Optional — duration of the call in seconds. */
  callDuration?: number | null;
}

export interface UpdateAuditPayload {
  callReference?: string;
  overallComment?: string | null;
  start?: boolean;
  answers?: Array<{
    questionId: number;
    value?: string | null;
    remark?: string | null;
  }>;
  sectionRemarks?: Array<{ sectionId: number; remark?: string | null }>;
  /** ACPT category — one of: "Agent" | "Customer" | "Process" | "Technology". Null to clear. */
  acptCategory?: string | null;
  /** Free-text Level 2 observations. Null to clear. */
  acptLevel2?: string | null;
  /** Free-text Level 3 observations. Null to clear. */
  acptLevel3?: string | null;
  /** Supervisor's observation about the call. Null to clear. */
  callObservation?: string | null;
  /** Supervisor's improvement notes for the agent. Null to clear. */
  areaOfImprovement?: string | null;
  /** Date the audited call took place. ISO date (YYYY-MM-DD) or full timestamp. Null to clear. */
  callDate?: string | null;
  /** Call duration in seconds. Null to clear. */
  callDuration?: number | null;
}

export interface SubmitAuditPayload {
  overallComment?: string | null;
  answers?: Array<{
    questionId: number;
    value?: string | null;
    remark?: string | null;
  }>;
  sectionRemarks?: Array<{ sectionId: number; remark?: string | null }>;
  /** ACPT category — one of: "Agent" | "Customer" | "Process" | "Technology". Null to clear. */
  acptCategory?: string | null;
  /** Free-text Level 2 observations. Null to clear. */
  acptLevel2?: string | null;
  /** Free-text Level 3 observations. Null to clear. */
  acptLevel3?: string | null;
  /** Supervisor's observation about the call. Null to clear. */
  callObservation?: string | null;
  /** Supervisor's improvement notes for the agent. Null to clear. */
  areaOfImprovement?: string | null;
  /** Date the audited call took place. ISO date (YYYY-MM-DD) or full timestamp. Null to clear. */
  callDate?: string | null;
  /** Call duration in seconds. Null to clear. */
  callDuration?: number | null;
}

export interface ListAuditParams {
  status?: AuditStatus;
  agentId?: string;
  projectId?: number;
  group?: string;
}

function toQueryParams(
  p: object,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;

    out[k] = String(v);
  }

  return out;
}

export async function listAudits(
  params: ListAuditParams = {},
): Promise<AuditListItem[]> {
  const res = await api.get<AuditListItem[]>("/audits", {
    params: toQueryParams(params),
  });
  return res.data;
}

export async function getAudit(id: number): Promise<AuditDetail> {
  const res = await api.get<AuditDetail>(`/audits/${id}`);
  return res.data;
}

/**
 * Create a draft audit. The backend automatically attaches the global
 * default QA template, so the supervisor never picks a scorecard.
 */
export async function createAudit(
  payload: CreateAuditPayload,
): Promise<AuditDetail> {
  const res = await api.post<AuditDetail>("/audits", payload);
  return res.data;
}

export async function updateAudit(
  id: number,
  payload: UpdateAuditPayload,
): Promise<AuditDetail> {
  const res = await api.patch<AuditDetail>(`/audits/${id}`, payload);
  return res.data;
}

export async function submitAudit(
  id: number,
  payload: SubmitAuditPayload = {},
): Promise<AuditDetail> {
  const res = await api.patch<AuditDetail>(`/audits/${id}/submit`, payload);
  return res.data;
}

export async function reopenAudit(
  id: number,
  reason?: string,
): Promise<AuditDetail> {
  const res = await api.patch<AuditDetail>(`/audits/${id}/reopen`, {
    reason,
  });
  return res.data;
}

/**
 * Publish a SUBMITTED audit so the agent can see it. Locks the audit
 * for everyone after this point.
 */
export async function publishAudit(id: number): Promise<AuditDetail> {
  const res = await api.patch<AuditDetail>(`/audits/${id}/publish`);
  return res.data;
}

/**
 * Discard (soft-delete) a DRAFT / IN_PROGRESS audit. Hides it from
 * every active list. Returns 204; the caller should refresh.
 */
export async function discardAudit(id: number): Promise<void> {
  await api.delete(`/audits/${id}`);
}

/**
 * Add (or clear) the supervisor correction note on a PUBLISHED /
 * REVIEWED audit. Pass `null` to clear. The locked score / answers /
 * overall comment are never touched — this is the safe post-publish
 * edit surface.
 */
export async function setCorrectionNote(
  id: number,
  note: string | null,
): Promise<AuditDetail> {
  const res = await api.patch<AuditDetail>(
    `/audits/${id}/correction-note`,
    { note },
  );
  return res.data;
}
