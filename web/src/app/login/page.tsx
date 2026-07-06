"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseApiResponse } from "@/lib/api";
import { apiFetch, clearToken, setToken } from "@/lib/sessionClient";

type Mode = "login" | "register";
type Role = "GP" | "SPECIALIST";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("GP");
  const [specialty, setSpecialty] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [hint, setHint] = useState("");

  useEffect(() => {
    fetch("/api/specialties")
      .then((r) => parseApiResponse<{ specialties?: string[] }>(r))
      .then((d) => setSpecialties(d.specialties || []))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const prefilledEmail = params.get("email");
    const next = params.get("next");
    const wantRole = params.get("role");
    if (prefilledEmail) setEmail(prefilledEmail);
    if (wantRole === "SPECIALIST") {
      setHint("Sign in with your specialist account to view inbound referrals.");
    } else if (next?.startsWith("/specialist")) {
      setHint("Use your specialist login — not your GP account.");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const isRegister = mode === "register";
      const res = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { name, email, password, role, specialty: role === "SPECIALIST" ? specialty : undefined }
            : { email, password }
        ),
      });
      const data = await parseApiResponse<{ token?: string; user?: { role: string }; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed");
      if (!data.token || !data.user) throw new Error("Invalid server response");

      setToken(data.token);

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const userRole = data.user.role;

      if (next?.startsWith("/specialist") && userRole === "GP") {
        clearToken();
        throw new Error(
          `${email} is a GP account. Use your specialist email instead (see Sent referrals for the recipient address).`
        );
      }

      if (next && userRole === "SPECIALIST" && next.startsWith("/specialist")) {
        router.push(next);
      } else {
        router.push(userRole === "GP" ? "/gp" : "/specialist/referrals");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-slate-900">medAI</h1>
        <p className="mt-1 text-sm text-slate-500">Clinic referral platform</p>
        {hint && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{hint}</p>
        )}

        <div className="mt-6 flex rounded-lg border border-slate-200 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-2 ${mode === "login" ? "bg-sky-100 font-medium text-sky-800" : "text-slate-600"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md py-2 ${mode === "register" ? "bg-sky-100 font-medium text-sky-800" : "text-slate-600"}`}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <>
            <label className="mt-5 block text-sm font-medium text-slate-700">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />

            <p className="mt-5 text-sm font-medium text-slate-700">I am a…</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("GP")}
                className={`rounded-lg border px-3 py-3 text-sm ${
                  role === "GP"
                    ? "border-sky-500 bg-sky-50 font-medium text-sky-800"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                GP
              </button>
              <button
                type="button"
                onClick={() => setRole("SPECIALIST")}
                className={`rounded-lg border px-3 py-3 text-sm ${
                  role === "SPECIALIST"
                    ? "border-sky-500 bg-sky-50 font-medium text-sky-800"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                Specialist
              </button>
            </div>

            {role === "SPECIALIST" && (
              <>
                <label className="mt-4 block text-sm font-medium text-slate-700">Your specialty</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                >
                  <option value="">Select specialty…</option>
                  {specialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </>
            )}
          </>
        )}

        <label className="mt-5 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          required
          minLength={6}
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        {mode === "login" && (
          <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium">Demo accounts</p>
            <p>GP: gp@medai.local / password123</p>
            <p>Cardiology: cardio@medai.local / password123</p>
            <p className="mt-2 text-slate-500">
              Use <span className="font-medium">localhost:3000</span> for both GP and specialist tabs.
              Do not use port 3001 — each port needs its own login.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
