"use client";

import { useCallback, useEffect, useState } from "react";
import { parseApiResponse } from "@/lib/api";
import { apiFetch } from "@/lib/sessionClient";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import type { SessionUser } from "@/lib/auth";
import { URGENCY_LEVELS, URGENCY_META, type UrgencyLevel } from "@/lib/urgency";
import {
  DEFAULT_TIER_FILTER,
  TIER_UI,
  type SpecialistTierFilter,
} from "@/lib/specialistTierFilter";

type FilterData = {
  tiers: SpecialistTierFilter;
  updatedAt: string | null;
};

type Props = { user: SessionUser };

type SaveStatus = "idle" | "saving" | "saved" | "error";

const TIER_PLACEHOLDERS: Record<UrgencyLevel, string> = {
  RED: "e.g.\nchest pain with radiation\nsuspected acute coronary syndrome\nsevere shortness of breath",
  ORANGE: "e.g.\nworsening chest discomfort\nnew palpitations without collapse\nrapidly progressing symptoms",
  YELLOW: "e.g.\nstable chest pain on exertion\nintermittent palpitations\nnew symptoms needing review",
  GREEN: "e.g.\nroutine follow-up\nchest pain already investigated and stable\nchronic stable conditions",
};

function TierCard({
  level,
  tier,
  onChange,
}: {
  level: UrgencyLevel;
  tier: SpecialistTierFilter[UrgencyLevel];
  onChange: (patch: Partial<SpecialistTierFilter[UrgencyLevel]>) => void;
}) {
  const ui = TIER_UI[level];
  const meta = URGENCY_META[level];

  return (
    <section className={`flex flex-col rounded-xl border ${ui.border} ${ui.bg} shadow-sm`}>
      <div className={`flex flex-wrap items-center gap-3 rounded-t-xl px-4 py-3 ${ui.header}`}>
        <span className={`h-3 w-3 shrink-0 rounded-full ${ui.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{meta.label}</p>
          <p className="text-xs opacity-80">{level}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap font-medium">Seen within</span>
          <input
            type="text"
            value={tier.timeframe}
            onChange={(e) => onChange({ timeframe: e.target.value })}
            placeholder={DEFAULT_TIER_FILTER[level].timeframe}
            className="w-28 rounded-lg border border-white/60 bg-white/90 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-sky-400"
          />
        </label>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <label className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          Conditions &amp; rules
        </label>
        <textarea
          value={tier.rules}
          onChange={(e) => onChange({ rules: e.target.value })}
          className="min-h-[120px] flex-1 resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-sky-400"
          placeholder={TIER_PLACEHOLDERS[level]}
          spellCheck
        />
        <p className="mt-2 text-xs text-slate-500">One condition per line. These are used directly when triaging referrals.</p>
      </div>
    </section>
  );
}

export function SpecialistFilterPage({ user }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [tiers, setTiers] = useState<SpecialistTierFilter>({ ...DEFAULT_TIER_FILTER });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await apiFetch("/api/specialist/filter");
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/specialist/filter")}&role=SPECIALIST&email=${encodeURIComponent(user.email)}`;
        return;
      }
      const data = await parseApiResponse<{ filter?: FilterData; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to load filter");
      if (data.filter?.tiers) setTiers(data.filter.tiers);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [user.email]);

  useEffect(() => {
    load();
  }, [load]);

  function updateTier(level: UrgencyLevel, patch: Partial<SpecialistTierFilter[UrgencyLevel]>) {
    setTiers((prev) => ({
      ...prev,
      [level]: { ...prev[level], ...patch },
    }));
    setSaveStatus("idle");
  }

  async function saveFilter() {
    setSaveStatus("saving");
    setMessage("");
    try {
      const res = await apiFetch("/api/specialist/filter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers }),
      });
      const data = await parseApiResponse<{ filter?: FilterData; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.filter) setTiers(data.filter.tiers);
      setSaveStatus("saved");
      setMessage("Rules saved — the AI will use these when triaging your referrals.");
    } catch (e) {
      setSaveStatus("error");
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : "";

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} role="SPECIALIST" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex flex-1 flex-col overflow-hidden p-6">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-slate-900">Urgency filter</h1>
              <p className="mt-1 text-sm text-slate-600">
                Set what belongs in each urgency tier and how soon patients should be seen. The AI uses
                these rules when GPs send you referrals.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saveLabel && (
                <span className={`text-sm ${saveStatus === "error" ? "text-red-600" : "text-slate-500"}`}>
                  {saveLabel}
                </span>
              )}
              {message && (
                <span className={`text-sm ${saveStatus === "error" ? "text-red-600" : "text-slate-500"}`}>
                  {message}
                </span>
              )}
              <button
                type="button"
                onClick={saveFilter}
                disabled={saveStatus === "saving"}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Save rules
              </button>
            </div>
          </div>

          {loadError && <p className="mb-3 text-sm text-red-600">{loadError}</p>}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-4 lg:grid-cols-2">
              {URGENCY_LEVELS.map((level) => (
                <TierCard
                  key={level}
                  level={level}
                  tier={tiers[level]}
                  onChange={(patch) => updateTier(level, patch)}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
