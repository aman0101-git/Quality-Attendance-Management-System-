import { api } from "@/services/api";
import type {
  ScorecardDetail,
  ScorecardListItem,
  ScorecardStatus,
  SectionInput,
} from "./types";

export interface CreateScorecardPayload {
  name: string;
  description?: string;
  groupName: string;
  projectId?: number;
  /** Optional initial structure. Editor builds it after creation if omitted. */
  sections?: SectionInput[];
}

export interface UpdateScorecardHeaderPayload {
  name?: string;
  description?: string | null;
  groupName?: string;
  projectId?: number | null;
}

export interface ListScorecardParams {
  groupName?: string;
  includeInactive?: boolean;
}

function toQueryParams(
  p: Record<string, string | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    out[k] = typeof v === "boolean" ? String(v) : v;
  }
  return out;
}

export async function listScorecards(
  params: ListScorecardParams = {},
): Promise<ScorecardListItem[]> {
  const res = await api.get<ScorecardListItem[]>("/scorecards", {
    params: toQueryParams({
      group: params.groupName,
      includeInactive: params.includeInactive,
    }),
  });
  return res.data;
}

export async function getScorecard(id: number): Promise<ScorecardDetail> {
  const res = await api.get<ScorecardDetail>(`/scorecards/${id}`);
  return res.data;
}

export async function createScorecard(
  payload: CreateScorecardPayload,
): Promise<ScorecardDetail> {
  const res = await api.post<ScorecardDetail>("/scorecards", payload);
  return res.data;
}

export async function updateScorecardHeader(
  id: number,
  payload: UpdateScorecardHeaderPayload,
): Promise<ScorecardDetail> {
  const res = await api.patch<ScorecardDetail>(`/scorecards/${id}`, payload);
  return res.data;
}

export async function updateScorecardStructure(
  id: number,
  sections: SectionInput[],
): Promise<ScorecardDetail> {
  const res = await api.patch<ScorecardDetail>(
    `/scorecards/${id}/structure`,
    { sections },
  );
  return res.data;
}

export async function setScorecardStatus(
  id: number,
  status: ScorecardStatus,
): Promise<ScorecardDetail> {
  const res = await api.patch<ScorecardDetail>(`/scorecards/${id}/status`, {
    status,
  });
  return res.data;
}

/**
 * Promote a template to the global default QA template. Demotes the
 * previous default and force-activates this one in the same call.
 */
export async function setScorecardAsDefault(
  id: number,
): Promise<ScorecardDetail> {
  const res = await api.patch<ScorecardDetail>(`/scorecards/${id}/default`);
  return res.data;
}

/**
 * Read the global default QA template (or null if none is configured).
 */
export async function getDefaultScorecard(): Promise<ScorecardDetail | null> {
  const res = await api.get<ScorecardDetail | null>("/scorecards/default");
  return res.data;
}
