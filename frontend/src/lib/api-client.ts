/**
 * api-client.ts — Supabase Auth edition
 *
 * The token is now sourced from the live Supabase session instead of
 * localStorage. This ensures the frontend always sends a fresh, valid
 * JWT to the Python backend regardless of token refresh cycles.
 */
import { supabase } from "./supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  public status: number;
  public detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // ── Token resolution ──────────────────────────────────────────────────────
  // Primary: Live Supabase session (auto-refreshes when expired)
  // Fallback: localStorage (for any edge case transition period)
  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
    token =
      typeof window !== "undefined"
        ? localStorage.getItem("finsight_token")
        : null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Auto sign-out on expired/invalid token
    if (response.status === 401 && typeof window !== "undefined") {
      await supabase.auth.signOut();
      localStorage.removeItem("finsight_token");
      localStorage.removeItem("finsight_user");
      window.location.href = "/auth/login";
    }
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // response body is not JSON — use default detail
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}
