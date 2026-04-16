"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth.api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(form.email, form.password);
      localStorage.setItem("finsight_token", res.access_token);
      localStorage.setItem("finsight_user", JSON.stringify(res.user));
      document.cookie = `finsight_token=${res.access_token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Strict`;
      setUser(res.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card rounded-2xl overflow-hidden flex flex-row-reverse shadow-2xl border border-border">

        {/* ── RIGHT: Form Panel ── */}
        <div className="flex-1 p-10 flex flex-col justify-center">
          {/* Logo */}
          <div className="mb-8">
            <span className="text-2xl font-bold font-outfit text-text">
              Fin<span className="text-lime">Sight</span>
              <span className="text-muted text-base font-normal ml-1">AI</span>
            </span>
          </div>

          <h1 className="text-3xl font-bold text-text font-outfit mb-1">Login</h1>
          <p className="text-muted text-sm mb-8">Manage your portfolio</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div>
              <label className="block text-sm text-muted mb-1.5">Your e-mail</label>
              <input
                type="email"
                name="email"
                placeholder="email@domain.com"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full bg-dim border border-border rounded-lg px-4 py-3 text-text text-sm
                           placeholder:text-muted focus:outline-none focus:border-lime transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-muted mb-1.5">Password</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••••••••••••••"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full bg-dim border border-border rounded-lg px-4 py-3 text-text text-sm
                           placeholder:text-muted focus:outline-none focus:border-lime transition-colors"
              />
              <div className="mt-1.5 text-right">
                <button type="button" className="text-xs text-muted hover:text-lime transition-colors">
                  Forgot my password?
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-lime text-background font-semibold py-3 rounded-lg
                         hover:bg-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         font-outfit text-sm"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="text-muted text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-lime underline underline-offset-2 hover:text-lime/80">
              Sign up
            </Link>
          </p>
        </div>

        {/* ── LEFT: Decorative Panel ── */}
        <div className="hidden md:flex flex-1 bg-dim relative overflow-hidden items-end p-6">
          <div className="absolute inset-0 bg-gradient-to-tl from-lime/5 via-transparent to-purple/10" />

          {/* Animated market ticker */}
          <div className="relative z-10 w-full space-y-2">
            <div className="bg-card2/80 backdrop-blur-sm border border-border rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted">NIFTY 50</p>
                <p className="text-text font-semibold text-sm">22,419.95</p>
              </div>
              <span className="text-green text-xs font-medium bg-green/10 px-2 py-0.5 rounded">+0.84%</span>
            </div>
            <div className="bg-card2/80 backdrop-blur-sm border border-border rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted">SENSEX</p>
                <p className="text-text font-semibold text-sm">73,828.43</p>
              </div>
              <span className="text-green text-xs font-medium bg-green/10 px-2 py-0.5 rounded">+0.71%</span>
            </div>
            <div className="bg-card2/80 backdrop-blur-sm border border-border rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted">NIFTY BANK</p>
                <p className="text-text font-semibold text-sm">47,112.20</p>
              </div>
              <span className="text-red text-xs font-medium bg-red/10 px-2 py-0.5 rounded">-0.22%</span>
            </div>
          </div>

          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-48 h-48 bg-lime/10 rounded-full blur-3xl" />
        </div>

      </div>
    </div>
  );
}
