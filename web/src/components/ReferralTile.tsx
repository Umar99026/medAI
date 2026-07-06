"use client";

import type { ReactNode } from "react";

type Props = {
  name: string;
  meta: string;
  date: string;
  issue: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Urgency background for specialist tiles — e.g. urgency-red */
  toneClass?: string;
};

export function ReferralTile({
  name,
  meta,
  date,
  issue,
  expanded,
  onToggle,
  children,
  toneClass,
}: Props) {
  return (
    <article
      className={`overflow-hidden rounded-xl border border-slate-200 ${toneClass ?? "bg-white"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-4 text-left ${
          toneClass ? "hover:brightness-[0.97]" : "hover:bg-slate-50"
        }`}
      >
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{name}</p>
          <p className="mt-0.5 text-sm text-slate-600">{meta}</p>
          <p className="mt-0.5 text-xs text-slate-500">{date}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-800">{issue}</p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3">{children}</div>
      )}
    </article>
  );
}

export function ReferralField({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

export function referralIssue(r: {
  presentingComplaint?: string;
  aiSummary?: string;
  noteContent?: string;
}): string {
  if (r.presentingComplaint?.trim()) return r.presentingComplaint.trim();
  if (r.aiSummary?.trim()) return r.aiSummary.trim();
  if (r.noteContent?.trim()) {
    const line = r.noteContent.trim().split(/\n/)[0];
    return line.length > 160 ? `${line.slice(0, 160)}…` : line;
  }
  return "No clinical details";
}

export function formatReferralDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
