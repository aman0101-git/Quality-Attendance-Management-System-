import { api } from "@/services/api";
import type { AuditDetail, AuditListItem, AuditStatus } from "./types";

export interface CreateAuditPayload {
  agentId: string;
  projectId: number;
  callReference: string;
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
}

export interface SubmitAuditPayload {
  overallComment?: string | null;
  answers?: Array<{
    questionId: number;
    value?: string | null;
    remark?: string | null;
  }>;
  sectionRemarks?: Array<{ sectionId: number; remark?: string | null }>;
}

export interface ListAuditParams {
  status?: AuditStatus;
  agentId?: string;
  projectId?: number;
  group?: string;
}

function toQueryParams(
  p: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
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
