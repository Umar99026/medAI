"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseApiResponse } from "@/lib/api";
import {
  URGENCY_LEVELS,
  URGENCY_META,
  urgencyBadgeClass,
  urgencyDisplay,
  urgencyToneClass,
  type UrgencyLevel,
} from "@/lib/urgency";
import { extractUrgencyReason, isGenericPriorityReason } from "@/lib/keywordTriage";
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

type Referral = {
  id: string;
  patientName: string;
  dob: string;
  sex: string;
  phone: string;
  email: string;
  presentingComplaint: string;
  history: string;
  vitals: string;
  medications: string;
  allergies: string;
  redFlags: string;
  suggestedSpecialty: string;
  urgency: UrgencyLevel;
  seenWithinDays: number;
  priorityReason: string;
  aiSummary: string;
  noteContent: string;
  bookingStatus: string;
  createdAt: string;
  gp: { name: string };
};

type Props = { user: SessionUser };

function displayPriorityReason(r: Referral): string {
  if (isGenericPriorityReason(r.priorityReason)) {
    return extractUrgencyReason(r.noteContent, r.urgency);
  }
  return r.priorityReason;
}

function referralSearchBlob(r: Referral): string {
  const d = new Date(r.createdAt);
  return [
    r.patientName,
    r.gp.name,
    r.presentingComplaint,
    r.aiSummary,
    r.noteContent,
    r.priorityReason,
    r.suggestedSpecialty,
    r.dob,
    formatReferralDate(r.createdAt),
    d.toLocaleDateString(),
    d.toISOString().slice(0, 10),
  ]
    .join(" ")
    .toLowerCase();
}

function matchesSearch(r: Referral, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return referralSearchBlob(r).includes(q);
}

type SortOrder = "newest" | "oldest";

export function SpecialistReferralsPage({ user }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [urgency, setUrgency] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [unread, setUnread] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bookingMsg, setBookingMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const params = new URLSearchParams();
    if (urgency !== "ALL") params.set("urgency", urgency);

    try {
      const [refRes, notifRes] = await Promise.all([
        apiFetch(`/api/referrals?${params}`),
        apiFetch("/api/notifications"),
      ]);

      if (refRes.status === 401) {
        setLoadError("Session expired — please sign in again.");
        window.location.href = `/login?next=${encodeURIComponent("/specialist/referrals")}&role=SPECIALIST&email=${encodeURIComponent(user.email)}`;
        return;
      }

      const refData = await parseApiResponse<{ referrals?: Referral[]; error?: string }>(refRes);
      if (!refRes.ok) throw new Error(refData.error || "Failed to load referrals");
      setReferrals(refData.referrals || []);

      if (notifRes.ok) {
        const notifData = await parseApiResponse<{ unreadCount?: number; notifications?: { id: string; read: boolean }[] }>(notifRes);
        setUnread(notifData.unreadCount || 0);
        const unreadIds = (notifData.notifications || [])
          .filter((n: { read: boolean }) => !n.read)
          .map((n: { id: string }) => n.id);
        if (unreadIds.length) {
          await apiFetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: unreadIds }),
          });
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load referrals");
    }
  }, [urgency, user.email]);

  const visibleReferrals = useMemo(() => {
    const filtered = referrals.filter((r) => matchesSearch(r, search));
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
  }, [referrals, search, sort]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") load();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  async function bookPatient(referralId: string) {
    setBookingMsg("");
    const res = await apiFetch("/api/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralId, action: "book" }),
    });
    const data = await parseApiResponse(res);
    if (res.ok) {
      setBookingMsg("Booking saved — full scheduling coming soon.");
      await load();
    }
  }

  function urgencyTone(level: Referral["urgency"]) {
    return urgencyToneClass(level);
  }

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} role="SPECIALIST" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <h1 className="text-xl font-semibold">Inbound referrals</h1>
              <p className="text-sm text-slate-500">
                Signed in as <span className="font-medium">{user.email}</span>
                {referrals.length > 0 &&
                  ` · ${visibleReferrals.length === referrals.length ? referrals.length : `${visibleReferrals.length} of ${referrals.length}`} referral${visibleReferrals.length === 1 ? "" : "s"}`}
              </p>
              {loadError && <p className="text-sm text-red-600">{loadError}</p>}
              {unread > 0 && <p className="text-sm text-sky-600">{unread} new notification(s)</p>}
              {bookingMsg && <p className="text-sm text-emerald-600">{bookingMsg}</p>}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, date, keyword…"
                className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOrder)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ALL">All urgency</option>
                {URGENCY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {URGENCY_META[level].filterLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {visibleReferrals.map((r) => (
              <ReferralTile
                key={r.id}
                name={r.patientName}
                meta={`From Dr. ${r.gp.name}`}
                date={formatReferralDate(r.createdAt)}
                issue={referralIssue(r)}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                toneClass={urgencyTone(r.urgency)}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyBadgeClass(r.urgency)}`}
                    >
                      {urgencyDisplay(r.urgency, r.seenWithinDays)}
                    </span>
                    <button
                      type="button"
                      onClick={() => bookPatient(r.id)}
                      disabled={r.bookingStatus === "booked"}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      {r.bookingStatus === "booked" ? "Booked" : "Book patient"}
                    </button>
                  </div>

                  {r.aiSummary && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Summary</p>
                      <p className="text-sm text-slate-800">{r.aiSummary}</p>
                    </div>
                  )}

                  {(r.priorityReason || r.noteContent) && (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Clinical note: </span>
                      {displayPriorityReason(r)}
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ReferralField label="Specialty" value={r.suggestedSpecialty} />
                    <ReferralField label="DOB" value={r.dob} />
                    <ReferralField label="Sex" value={r.sex} />
                    <ReferralField label="Phone" value={r.phone} />
                    <ReferralField label="Email" value={r.email} />
                    <ReferralField label="Presenting complaint" value={r.presentingComplaint} />
                    <ReferralField label="History" value={r.history} />
                    <ReferralField label="Vitals" value={r.vitals} />
                    <ReferralField label="Medications" value={r.medications} />
                    <ReferralField label="Allergies" value={r.allergies} />
                    <ReferralField label="Red flags" value={r.redFlags} />
                  </div>

                  {r.noteContent && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Original note / letter
                      </p>
                      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
                        {r.noteContent}
                      </pre>
                    </div>
                  )}
                </div>
              </ReferralTile>
            ))}
            {referrals.length === 0 && (
              <p className="text-sm text-slate-500">
                No referrals yet. When a GP sends one to you, it will appear here automatically.
              </p>
            )}
            {referrals.length > 0 && visibleReferrals.length === 0 && (
              <p className="text-sm text-slate-500">No referrals match your search.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
