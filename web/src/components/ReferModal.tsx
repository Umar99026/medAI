"use client";

import { useEffect, useState } from "react";
import { parseApiResponse } from "@/lib/api";
import { apiFetch } from "@/lib/sessionClient";

type Specialist = {
  id: string;
  name: string;
  email: string;
  specialty: string | null;
  isDummy: boolean;
  suggested?: boolean;
};

type Classification = {
  suggestedSpecialties: string[];
  reasoning: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  noteId: string | null;
  content: string;
  patientName: string;
  onReferred: (specialist: { name: string; email: string }) => void;
};

export function ReferModal({ open, onClose, noteId, content, patientName, onReferred }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setClassification(null);
    setSpecialists([]);

    apiFetch("/api/referrals/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ noteId, content }),
    })
      .then(async (r) => {
        const data = await parseApiResponse<{
          error?: string;
          classification?: Classification;
          specialists?: Specialist[];
        }>(r);
        if (!r.ok) throw new Error(data.error || "Classification failed");
        setClassification(data.classification ?? null);
        setSpecialists(data.specialists ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Classification failed"))
      .finally(() => setLoading(false));
  }, [open, noteId, content]);

  async function refer(specialist: Specialist) {
    setSubmitting(specialist.id);
    setError("");
    try {
      const res = await apiFetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          noteId,
          specialistId: specialist.id,
          content,
          patientName,
        }),
      });
      const data = await parseApiResponse<{ referral?: { id: string }; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Referral failed");
      if (!data.referral?.id) throw new Error("Referral was not saved — please try again");
      onReferred({ name: specialist.name, email: specialist.email });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Referral failed");
    } finally {
      setSubmitting(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Refer to specialist</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <p className="text-sm text-slate-500">AI is determining which specialist type is needed…</p>
          )}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          {classification && (
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">
                AI suggests: {classification.suggestedSpecialties.join(", ")}
              </p>
              {classification.reasoning && (
                <p className="mt-1 text-sm text-sky-800">{classification.reasoning}</p>
              )}
              <p className="mt-2 text-xs text-sky-700">
                Urgency and full patient details are extracted when you send the referral.
              </p>
            </div>
          )}

          <p className="mb-2 text-sm font-medium text-slate-700">Who should receive this referral?</p>
          <div className="space-y-2">
            {specialists.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  s.suggested ? "border-sky-200 bg-sky-50/50" : "border-slate-200"
                }`}
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {s.name}
                    {s.suggested && (
                      <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                        Suggested
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{s.specialty || "General"}</p>
                  <p className="text-xs font-medium text-sky-700">{s.email}</p>
                </div>
                <button
                  type="button"
                  disabled={!!submitting}
                  onClick={() => refer(s)}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {submitting === s.id ? "Sending…" : "Refer"}
                </button>
              </div>
            ))}
            {!loading && specialists.length === 0 && (
              <p className="text-sm text-slate-500">
                No specialists found. Run <code className="text-xs">npm run db:seed</code> or create a
                specialist account.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
