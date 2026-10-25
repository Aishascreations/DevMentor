"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister
        ? { email, username, password }
        : { email, password };

      const res = await apiFetch<{ access_token: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setToken(res.access_token);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-2xl mx-auto mb-3">
            D
          </div>
          <h1 className="text-2xl font-bold">Welcome to DevMentor</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isRegister ? "Create a new account" : "Sign in to continue"}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                USERNAME
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="devmentor_user"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              PASSWORD
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-xs text-indigo-400 hover:underline"
          >
            {isRegister
              ? "Already have an account? Sign In"
              : "Need an account? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
}