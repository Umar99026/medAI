"use client";

import { useRouter } from "next/navigation";
import { apiFetch, clearToken } from "@/lib/sessionClient";
import type { SessionUser } from "@/lib/auth";

type Props = {
  user: SessionUser;
};

export function TopBar({ user }: Props) {
  const router = useRouter();

  async function logout() {
    clearToken();
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-800">{user.name}</p>
        <p className="text-xs text-slate-500">
          {user.role === "GP" ? "General Practitioner" : `${user.specialty || "Specialist"} · ${user.email}`}
        </p>
      </div>
      <button
        type="button"
        onClick={logout}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        Log out
      </button>
    </header>
  );
}
