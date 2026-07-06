import {
  URGENCY_LEVELS,
  URGENCY_META,
  defaultSeenWithinDays,
  formatSeenWithin,
  type UrgencyLevel,
} from "./urgency";

export type TierInput = {
  rules: string;
  timeframe: string;
};

export type SpecialistTierFilter = Record<UrgencyLevel, TierInput>;

export const DEFAULT_TIER_FILTER: SpecialistTierFilter = {
  RED: { rules: "", timeframe: "2 days" },
  ORANGE: { rules: "", timeframe: "1 week" },
  YELLOW: { rules: "", timeframe: "3 weeks" },
  GREEN: { rules: "", timeframe: "8 weeks" },
};

export const TIER_UI: Record<
  UrgencyLevel,
  { border: string; bg: string; header: string; dot: string }
> = {
  RED: {
    border: "border-red-200",
    bg: "bg-red-50/50",
    header: "bg-red-100 text-red-900",
    dot: "bg-red-400",
  },
  ORANGE: {
    border: "border-orange-200",
    bg: "bg-orange-50/50",
    header: "bg-orange-100 text-orange-900",
    dot: "bg-orange-400",
  },
  YELLOW: {
    border: "border-amber-200",
    bg: "bg-amber-50/50",
    header: "bg-amber-100 text-amber-900",
    dot: "bg-amber-400",
  },
  GREEN: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/50",
    header: "bg-emerald-100 text-emerald-900",
    dot: "bg-emerald-400",
  },
};

/** Parse "2 days", "3 weeks", etc. into days */
export function parseTimeframeToDays(text: string, level: UrgencyLevel): number {
  const t = text.trim().toLowerCase();
  if (!t) return defaultSeenWithinDays(level);
  if (/same\s*day|asap|immediate/.test(t)) return 0;

  const weekMatch = t.match(/(\d+(?:\.\d+)?)\s*weeks?/);
  if (weekMatch) return Math.round(parseFloat(weekMatch[1]) * 7);

  const dayMatch = t.match(/(\d+(?:\.\d+)?)\s*days?/);
  if (dayMatch) return Math.round(parseFloat(dayMatch[1]));

  const bare = parseInt(t, 10);
  if (!Number.isNaN(bare)) return bare;

  return defaultSeenWithinDays(level);
}

export function normalizeTierFilter(raw: unknown): SpecialistTierFilter {
  const base = { ...DEFAULT_TIER_FILTER };
  if (!raw || typeof raw !== "object") return base;

  for (const level of URGENCY_LEVELS) {
    const tier = (raw as Record<string, unknown>)[level];
    if (!tier || typeof tier !== "object") continue;
    const t = tier as Record<string, unknown>;
    base[level] = {
      rules: String(t.rules ?? ""),
      timeframe: String(t.timeframe ?? base[level].timeframe),
    };
  }
  return base;
}

/** Build canonical rule memory text for the AI from 4 tier boxes */
export function compileTierRules(tiers: SpecialistTierFilter): string {
  const blocks: string[] = [];

  for (const level of URGENCY_LEVELS) {
    const tier = tiers[level];
    const ruleLines = tier.rules
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith("-") ? l : `- ${l}`));

    if (!ruleLines.length && !tier.timeframe.trim()) continue;

    const days = parseTimeframeToDays(tier.timeframe, level);
    const wait = formatSeenWithin(days);

    blocks.push(
      `=== ${level} — ${URGENCY_META[level].label} (seen within ${wait}) ===`,
      `Default wait for this tier: ${days} days (${wait})`,
      ...ruleLines.map((line) => {
        const condition = line.replace(/^[-*•]\s*/, "").trim();
        return `- ${condition} → ${level}`;
      })
    );
  }

  return blocks.join("\n").trim();
}

export function parseStoredTierConfig(filter: {
  tierConfig?: string | null;
  processedRules?: string | null;
  instructions?: string | null;
} | null): SpecialistTierFilter {
  if (filter?.tierConfig?.trim()) {
    try {
      return normalizeTierFilter(JSON.parse(filter.tierConfig));
    } catch {
      /* fall through */
    }
  }

  const legacy = filter?.processedRules?.trim() || filter?.instructions?.trim();
  if (legacy) {
    return {
      ...DEFAULT_TIER_FILTER,
      GREEN: { ...DEFAULT_TIER_FILTER.GREEN, rules: legacy },
    };
  }

  return { ...DEFAULT_TIER_FILTER };
}
