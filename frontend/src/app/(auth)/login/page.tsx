"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Activity, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.login({ email, password });
      await login(data.access_token);
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = async () => {
    setEmail("eleanor@example.com");
    setPassword("password123");
    setError(null);
    // Automatically trigger seed if needed and login
    setLoading(true);
    try {
      try {
        await api.seedDemo();
      } catch {
        // demo might already be seeded
      }
      const data = await api.login({ email: "eleanor@example.com", password: "password123" });
      await login(data.access_token);
    } catch (err: any) {
      setError(err.message || "Failed to login with demo credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-700/20">
            <Activity className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            MediKiosk
          </h2>
          <p className="mt-1 text-sm font-medium text-teal-700 dark:text-teal-400">
            AI Clinical Intake & Longitudinal Health Copilot
          </p>
          <p className="mt-2 text-xs text-slate-550 dark:text-slate-400">
            Pre-consultation clinical historian • Explicitly non-diagnostic
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In to Health Record"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Button */}
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDemoFill}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
            >
              <Sparkles className="h-4 w-4 text-teal-600" />
              Auto-Sign In with Demo Patient (Eleanor Vance)
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-teal-700 hover:underline dark:text-teal-400"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Safety Note */}
        <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-teal-600" />
          <span>Privacy-first, user-confirmed records. Non-diagnostic.</span>
        </div>
      </div>
    </div>
  );
}
