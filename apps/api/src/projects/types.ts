/**
 * App-side mirror of the Prisma `ProjectStatus` enum.
 * Keeping this here lets the rest of the codebase (DTOs, services, types)
 * stay decoupled from `@prisma/client` for type-only references.
 */
export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/** Public-safe shape returned by the API. */
export interface ProjectResponse {
  id: number;
  projectName: string;
  groupName: string;
  description: string | null;
  status: ProjectStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    username: string;
  };
}

/** Group of projects keyed by `groupName`. */
export interface GroupedProjects {
  groupName: string;
  count: number;
  projects: ProjectResponse[];
}
