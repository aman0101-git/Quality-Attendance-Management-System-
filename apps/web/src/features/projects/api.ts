import { api } from "@/services/api";
import type { Project, ProjectGroup, ProjectStatus } from "./types";

export interface CreateProjectPayload {
  projectName: string;
  groupName: string;
  description?: string;
  status?: ProjectStatus;
}

export interface ListProjectsParams {
  status?: ProjectStatus;
  group?: string;
  /** When `true`, soft-deleted (`isActive=false`) rows are also returned. */
  includeInactive?: boolean;
}

export interface ListGroupedParams {
  status?: ProjectStatus;
  includeInactive?: boolean;
}

function toQueryParams(
  params: Record<string, string | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    out[k] = typeof v === "boolean" ? String(v) : v;
  }
  return out;
}

export async function createProject(
  payload: CreateProjectPayload,
): Promise<Project> {
  const response = await api.post<Project>("/projects", payload);
  return response.data;
}

export async function getProjects(
  params: ListProjectsParams = {},
): Promise<Project[]> {
  const response = await api.get<Project[]>("/projects", {
    params: toQueryParams(params),
  });
  return response.data;
}

export async function getGroupedProjects(
  params: ListGroupedParams = {},
): Promise<ProjectGroup[]> {
  const response = await api.get<ProjectGroup[]>("/projects/grouped", {
    params: toQueryParams(params),
  });
  return response.data;
}

export async function updateProjectStatus(
  id: number,
  status: ProjectStatus,
): Promise<Project> {
  const response = await api.patch<Project>(`/projects/${id}/status`, {
    status,
  });
  return response.data;
}
