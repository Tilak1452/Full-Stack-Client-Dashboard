/**
 * auth.api.ts — Supabase Auth edition
 *
 * All login/register/logout calls now go directly to Supabase GoTrue
 * (cloud-hosted, no Python backend involved). The response is mapped
 * into the same AuthResponse shape the rest of the app expects, so
 * login.tsx / signup.tsx need minimal changes.
 */
import { supabase } from "./supabase";

export interface UserPublic {
  id: string;          // UUID string from Supabase (was int in legacy)
  name: string;
  email: string;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserPublic;
}

export const authApi = {
  /** Sign up a new user. Supabase stores credentials — no backend call needed. */
  register: async (
    name: string,
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }, // stored in user_metadata
    });

    if (error) throw new Error(error.message);

    // If email confirmation is required, data.session will be null
    if (!data.session) {
      throw new Error(
        "Account created! Please check your email to confirm your account before logging in."
      );
    }

    return {
      access_token: data.session.access_token,
      token_type: "bearer",
      user: {
        id: data.user!.id,
        name: data.user!.user_metadata?.name ?? name,
        email: data.user!.email!,
        is_active: true,
      },
    };
  },

  /** Sign in an existing user. */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);

    return {
      access_token: data.session.access_token,
      token_type: "bearer",
      user: {
        id: data.user.id,
        name:
          data.user.user_metadata?.name ??
          data.user.email!.split("@")[0],
        email: data.user.email!,
        is_active: true,
      },
    };
  },

  /** Sign out the current user from Supabase. */
  logout: async (): Promise<{ message: string }> => {
    await supabase.auth.signOut();
    return { message: "Logged out successfully." };
  },

  /** Get the currently authenticated user's profile. */
  me: async (): Promise<UserPublic> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Not authenticated.");
    return {
      id: data.user.id,
      name: data.user.user_metadata?.name ?? "",
      email: data.user.email!,
      is_active: true,
    };
  },
};

// ─── Legacy helpers (kept for backward compatibility with auth-context) ────────

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
