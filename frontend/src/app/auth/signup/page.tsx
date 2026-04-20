"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth.api";
import { useAuth } from "@/lib/auth-context";

export default function SignUpPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(form.name, form.email, form.password);
      // Mirror the access_token into a cookie so Next.js middleware can read it
      document.cookie = `finsight_token=${res.access_token}; path=/; SameSite=Strict`;
      localStorage.setItem("finsight_token", res.access_token);
      localStorage.setItem("finsight_user", JSON.stringify(res.user));
      setUser(res.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card rounded-2xl overflow-hidden flex shadow-2xl border border-border">

        {/* ── LEFT: Form Panel ── */}
        <div className="flex-1 p-10 flex flex-col justify-center">
          {/* Logo */}
          <div className="mb-8">
            <span className="text-2xl font-bold font-outfit text-text">
              Fin<span className="text-lime">Sight</span>
              <span className="text-muted text-base font-normal ml-1">AI</span>
            </span>
          </div>

          <h1 className="text-3xl font-bold text-text font-outfit mb-1">Sign up</h1>
          <p className="text-muted text-sm mb-8">Create your account for free</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Name */}
            <div>
              <label className="block text-sm text-muted mb-1.5">Your name</label>
              <input
                type="text"
                name="name"
                placeholder="Name Lastname"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full bg-dim border border-border rounded-lg px-4 py-3 text-text text-sm
                           placeholder:text-muted focus:outline-none focus:border-lime transition-colors"
              />
            </div>

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
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full bg-dim border border-border rounded-lg px-4 py-3 text-text text-sm
                           placeholder:text-muted focus:outline-none focus:border-lime transition-colors"
              />
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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-muted text-sm mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-lime underline underline-offset-2 hover:text-lime/80">
              Log in
            </Link>
          </p>
        </div>

        {/* ── RIGHT: Decorative Panel ── */}
        <div className="hidden md:flex flex-1 bg-dim relative overflow-hidden items-end p-6">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-lime/5 via-transparent to-purple/10" />

          {/* Mock UI card — mirrors the screenshot overlay */}
          <div className="relative z-10 w-full bg-card2/80 backdrop-blur-sm border border-border rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-muted text-xs">Portfolio</span>
              <span className="text-lime text-xs font-semibold">Live ↑</span>
            </div>
            {[
              { label: "RELIANCE.NS", change: "+2.4%" },
              { label: "TCS.NS", change: "+1.1%" },
              { label: "INFY.NS", change: "-0.3%" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-text text-sm">{item.label}</span>
                <span className={`text-xs font-medium ${item.change.startsWith("+") ? "text-green" : "text-red"}`}>
                  {item.change}
                </span>
              </div>
            ))}
          </div>

          {/* Background glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-48 h-48 bg-lime/10 rounded-full blur-3xl" />
        </div>

      </div>
    </div>
  );
}
