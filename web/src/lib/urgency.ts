export type UrgencyLevel = "RED" | "ORANGE" | "YELLOW" | "GREEN";

export const URGENCY_LEVELS: UrgencyLevel[] = ["RED", "ORANGE", "YELLOW", "GREEN"];

export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  RED: 0,
  ORANGE: 1,
  YELLOW: 2,
  GREEN: 3,
};

export const URGENCY_META: Record<
  UrgencyLevel,
  { label: string; filterLabel: string; defaultDays: number }
> = {
  RED: { label: "Urgent", filterLabel: "Urgent", defaultDays: 2 },
  ORANGE: { label: "Moderately urgent", filterLabel: "Moderate", defaultDays: 7 },
  YELLOW: { label: "Somewhat urgent", filterLabel: "Somewhat", defaultDays: 21 },
  GREEN: { label: "Not urgent", filterLabel: "Not urgent", defaultDays: 56 },
};

export function normalizeUrgency(v: unknown): UrgencyLevel {
  const u = String(v || "").toUpperCase();
  if (u === "AMBER") return "ORANGE";
  if (u === "RED" || u === "ORANGE" || u === "YELLOW" || u === "GREEN") return u;
  return "GREEN";
}

export function defaultSeenWithinDays(level: UrgencyLevel): number {
  return URGENCY_META[level].defaultDays;
}

export function effectiveSeenWithinDays(level: UrgencyLevel, days?: number | null): number {
  if (typeof days === "number" && days > 0) return days;
  return defaultSeenWithinDays(level);
}

/** Human-readable wait time — e.g. "3 days", "2 weeks" */
export function formatSeenWithin(days: number): string {
  if (days <= 0) return "Same day";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return "1 week";
  return `${weeks} weeks`;
}

export function urgencyLabel(level: string): string {
  const u = normalizeUrgency(level);
  return URGENCY_META[u].label;
}

/** Badge text: "Not urgent · 8 weeks" */
export function urgencyDisplay(level: UrgencyLevel | string, seenWithinDays?: number | null): string {
  const u = normalizeUrgency(level);
  const days = effectiveSeenWithinDays(u, seenWithinDays);
  return `${URGENCY_META[u].label} · ${formatSeenWithin(days)}`;
}

export function urgencyToneClass(level: UrgencyLevel | string): string {
  const u = normalizeUrgency(level);
  if (u === "RED") return "urgency-red";
  if (u === "ORANGE") return "urgency-orange";
  if (u === "YELLOW") return "urgency-yellow";
  return "urgency-green";
}

export function urgencyBadgeClass(level: UrgencyLevel | string): string {
  const u = normalizeUrgency(level);
  if (u === "RED") return "bg-red-100 text-red-800";
  if (u === "ORANGE") return "bg-orange-100 text-orange-900";
  if (u === "YELLOW") return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

export function normalizeSeenWithinDays(
  raw: unknown,
  urgency: UrgencyLevel
): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.round(n);
  return defaultSeenWithinDays(urgency);
}
