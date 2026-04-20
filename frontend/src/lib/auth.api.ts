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
    apiFetch<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    apiFetch<UserPublic>("/api/v1/auth/me"),

  logout: () =>
    apiFetch<{ message: string }>("/api/v1/auth/logout", { method: "POST" }),
};

/** Call on every app startup to restore session from sessionStorage */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("finsight_token");
}

export function getStoredUser(): UserPublic | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("finsight_user");
  return raw ? JSON.parse(raw) : null;
}

export function clearAuthStorage(): void {
  sessionStorage.removeItem("finsight_token");
  sessionStorage.removeItem("finsight_user");
}
