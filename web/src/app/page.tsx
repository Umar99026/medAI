"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseApiResponse } from "@/lib/api";
import { apiFetch } from "@/lib/sessionClient";
import type { SessionUser } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => parseApiResponse<{ user: SessionUser | null }>(r))
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        router.replace(data.user.role === "GP" ? "/gp" : "/specialist/referrals");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Loading…
    </div>
  );
}
