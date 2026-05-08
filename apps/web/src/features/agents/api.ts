import { api } from "@/services/api";
import type { UserRole } from "@/types/navigation";

export interface AgentUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listUsersByRole(
  role?: UserRole,
): Promise<AgentUser[]> {
  const response = await api.get<AgentUser[]>("/users", {
    params: role ? { role } : {},
  });
  return response.data;
}

/** Convenience: list AGENT users only. */
export async function listAgents(): Promise<AgentUser[]> {
  return listUsersByRole("AGENT");
}
