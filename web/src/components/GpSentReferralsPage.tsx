"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseApiResponse } from "@/lib/api";
import { urgencyBadgeClass, urgencyDisplay, type UrgencyLevel } from "@/lib/urgency";
import { apiFetch } from "@/lib/sessionClient";
import {
  ReferralField,
  ReferralTile,
  formatReferralDate,
  referralIssue,
} from "@/components/ReferralTile";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import type { SessionUser } from "@/lib/auth";

type SentReferral = {
  id: string;
  patientName: string;
  suggestedSpecialty: string;
  urgency: UrgencyLevel;
  seenWithinDays?: number;
  priorityReason: string;
  aiSummary: string;
  presentingComplaint?: string;
  noteContent?: string;
  dob?: string;
  sex?: string;
  phone?: string;
  email?: string;
  history?: string;
  vitals?: string;
  medications?: string;
  allergies?: string;
  redFlags?: string;
  createdAt: string;
  specialist: { name: string; email: string; specialty: string | null };
};

type Props = { user: SessionUser };

export function GpSentReferralsPage({ user }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [referrals, setReferrals] = useState<SentReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadError("");
    apiFetch("/api/referrals")
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return { referrals: [] };
        }
        const data = await parseApiResponse<{ referrals?: SentReferral[]; error?: string }>(r);
        if (!r.ok) throw new Error(data.error || "Failed to load referrals");
        return data;
      })
      .then((data) => setReferrals(data.referrals || []))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load referrals"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} role="GP" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-4">
          <h1 className="text-xl font-semibold">Sent referrals</h1>
          <p className="mt-1 text-sm text-slate-500">
            Referrals you have sent to specialists. Patient notes stay on the Notes page.
          </p>
          {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}

          {loading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

          <div className="mt-4 space-y-2">
            {referrals.map((r) => (
              <ReferralTile
                key={r.id}
                name={r.patientName}
                meta={`To ${r.specialist.name}${r.specialist.specialty ? ` · ${r.specialist.specialty}` : ""}`}
                date={formatReferralDate(r.createdAt)}
                issue={referralIssue(r)}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="space-y-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyBadgeClass(r.urgency)}`}
                  >
                    {urgencyDisplay(r.urgency, r.seenWithinDays)}
                  </span>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Recipient: </span>
                    {r.specialist.email}
                  </p>
                  {r.aiSummary && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Summary</p>
                      <p className="text-sm text-slate-800">{r.aiSummary}</p>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ReferralField label="Specialty" value={r.suggestedSpecialty} />
                    <ReferralField label="DOB" value={r.dob || ""} />
                    <ReferralField label="Sex" value={r.sex || ""} />
                    <ReferralField label="Phone" value={r.phone || ""} />
                    <ReferralField label="Email" value={r.email || ""} />
                    <ReferralField label="History" value={r.history || ""} />
                    <ReferralField label="Vitals" value={r.vitals || ""} />
                    <ReferralField label="Medications" value={r.medications || ""} />
                    <ReferralField label="Allergies" value={r.allergies || ""} />
                    <ReferralField label="Red flags" value={r.redFlags || ""} />
                  </div>
                  {r.noteContent && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Original note
                      </p>
                      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
                        {r.noteContent}
                      </pre>
                    </div>
                  )}
                  <Link
                    href={`/login?next=${encodeURIComponent("/specialist/referrals")}&email=${encodeURIComponent(r.specialist.email)}&role=SPECIALIST`}
                    className="inline-block text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    View as {r.specialist.email} →
                  </Link>
                </div>
              </ReferralTile>
            ))}
            {!loading && referrals.length === 0 && (
              <p className="text-sm text-slate-500">You haven&apos;t sent any referrals yet.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
