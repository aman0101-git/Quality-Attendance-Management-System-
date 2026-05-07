import { create } from "zustand";

type UserRole = "ADMIN" | "SUPERVISOR" | "AGENT";

interface User {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: (user, token) =>
    set({
      user,
      accessToken: token,
      isAuthenticated: true,
    }),

  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),
}));