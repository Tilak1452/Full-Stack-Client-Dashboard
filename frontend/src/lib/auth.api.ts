import { apiFetch } from "./api-client";

interface UserPublic {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    apiFetch<UserPublic>("/auth/me"),

  logout: () =>
    apiFetch<{ message: string }>("/auth/logout", { method: "POST" }),
};

/** Call on every app startup to restore session from localStorage */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("finsight_token");
}

export function getStoredUser(): UserPublic | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("finsight_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearAuthStorage(): void {
  localStorage.removeItem("finsight_token");
  localStorage.removeItem("finsight_user");
}
