"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getStoredUser, clearAuthStorage } from "./auth.api";

interface UserPublic {
  id: number;
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

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUserState(stored);
  }, []);

  const setUser = (u: UserPublic | null) => {
    setUserState(u);
    if (u) {
      sessionStorage.setItem("finsight_user", JSON.stringify(u));
    }
  };

  const logout = () => {
    setUserState(null);
    clearAuthStorage();
    document.cookie = "finsight_token=; path=/; max-age=0";
    window.location.href = "/auth/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
