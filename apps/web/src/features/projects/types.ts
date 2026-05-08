export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export interface ProjectCreator {
  id: string;
  name: string;
  username: string;
}

export interface Project {
  id: number;
  projectName: string;
  groupName: string;
  description: string | null;
  status: ProjectStatus;
  isActive: boolean;
  /** ISO timestamps from the API (Date objects on the server). */
  createdAt: string;
  updatedAt: string;
  createdBy: ProjectCreator;
}

export interface ProjectGroup {
  groupName: string;
  count: number;
  projects: Project[];
}
