"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "./supabase";
import { clearAuthStorage } from "./auth.api";

export interface UserPublic {
  id: string;    // UUID string from Supabase
  name: string;
  email: string;
  is_active: boolean;
}

interface AuthContextValue {
  user: UserPublic | null;
  setUser: (user: UserPublic | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserPublic | null>(null);

  // ── Restore session from Supabase on mount ────────────────────────────────
  useEffect(() => {
    // Immediately check if there's a live Supabase session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const u = data.session.user;
        setUserState({
          id: u.id,
          name: u.user_metadata?.name ?? u.email!.split("@")[0],
          email: u.email!,
          is_active: true,
        });
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUserState({
          id: u.id,
          name: u.user_metadata?.name ?? u.email!.split("@")[0],
          email: u.email!,
          is_active: true,
        });
      } else {
        setUserState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setUser = (u: UserPublic | null) => {
    setUserState(u);
  };

  const logout = async () => {
    setUserState(null);
    clearAuthStorage();
    document.cookie = "finsight_token=; path=/; max-age=0";
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
