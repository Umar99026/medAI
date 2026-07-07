"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseApiResponse } from "@/lib/api";
import { clearToken, apiFetch } from "@/lib/sessionClient";
import type { SessionUser } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

type Props = {
  role?: Role;
  Page: React.ComponentType<{ user: SessionUser }>;
};

export function AuthGate({ role, Page }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [wrongRole, setWrongRole] = useState<SessionUser | null>(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => parseApiResponse<{ user: SessionUser | null }>(r))
      .then((data) => {
        if (!data.user) {
          const next = role === "SPECIALIST" ? "/specialist/referrals" : "/gp";
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        if (role && data.user.role !== role) {
          setWrongRole(data.user);
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.replace("/login"));
  }, [role, router]);

  if (wrongRole) {
    const needSpecialist = role === "SPECIALIST";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Wrong account type</h2>
          <p className="mt-2 text-sm text-slate-600">
            You&apos;re signed in as <span className="font-medium">{wrongRole.email}</span> (
            {wrongRole.role === "GP" ? "GP" : "Specialist"}).
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {needSpecialist
              ? "This inbox needs your specialist account — not your GP account. GP and specialist are separate logins, even if the emails look similar."
              : "This page is for GPs only."}
          </p>
          <button
            type="button"
            onClick={() => {
              clearToken();
              const next = needSpecialist ? "/specialist/referrals" : "/gp";
              router.push(`/login?next=${encodeURIComponent(next)}${needSpecialist ? "&role=SPECIALIST" : ""}`);
            }}
            className="mt-4 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Sign in with {needSpecialist ? "specialist" : "GP"} account
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return <Page user={user} />;
}
