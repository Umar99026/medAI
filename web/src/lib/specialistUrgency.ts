import type { UrgencyLevel } from "./urgency";
import type { SpecialistTierFilter } from "./specialistTierFilter";
import { parseTimeframeToDays } from "./specialistTierFilter";

/** Clinical term variants — exertion ≈ activity, etc. */
const TERM_GROUPS: string[][] = [
  ["activity", "activities", "exertion", "exercise", "effort", "physical"],
  ["chest pain", "chest discomfort", "angina"],
  ["palpitation", "palpitations", "heart racing", "irregular heartbeat"],
  ["shortness of breath", "dyspnoea", "dyspnea", "breathless", "sob"],
  ["stable", "chronic", "longstanding", "long-standing"],
];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "on", "with", "when", "during", "doing",
  "for", "to", "in", "at", "is", "are", "was", "were", "has", "have", "had",
]);

function normalizeTerm(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Expand a token to synonym variants */
function expandToken(token: string): string[] {
  const t = token.toLowerCase().replace(/s$/, "");
  const out = new Set<string>([t, token.toLowerCase()]);
  for (const group of TERM_GROUPS) {
    if (group.some((g) => g === t || g.startsWith(t) || t.startsWith(g))) {
      group.forEach((g) => out.add(g));
    }
  }
  return [...out];
}

/** Multi-word phrase groups checked before single tokens */
function phraseGroupsInNote(noteLower: string): Set<string> {
  const found = new Set<string>();
  for (const group of TERM_GROUPS) {
    for (const phrase of group) {
      if (phrase.includes(" ") && noteLower.includes(phrase)) {
        group.forEach((g) => found.add(g));
      }
    }
  }
  return found;
}

function noteContainsTerm(noteLower: string, term: string, phraseHits: Set<string>): boolean {
  const t = normalizeTerm(term);
  if (!t) return false;
  if (noteLower.includes(t)) return true;
  if (phraseHits.has(t)) return true;

  if (t.includes(" ")) {
    return expandToken(t).some((v) => v.includes(" ") && noteLower.includes(v));
  }

  return expandToken(t).some((v) => {
    if (v.includes(" ")) return noteLower.includes(v);
    return new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(noteLower);
  });
}

export function noteMatchesCondition(noteContent: string, condition: string): boolean {
  const noteLower = normalizeTerm(noteContent);
  const c = normalizeCondition(condition);
  if (!c || c.length < 3) return false;

  if (noteLower.includes(c)) return true;

  const phraseHits = phraseGroupsInNote(noteLower);

  // Multi-word phrases in condition (e.g. "chest pain")
  const phraseParts = TERM_GROUPS.flatMap((g) => g.filter((p) => p.includes(" ") && c.includes(p)));
  for (const phrase of phraseParts) {
    if (noteContainsTerm(noteLower, phrase, phraseHits)) return true;
  }

  const tokens = c
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (tokens.length === 0) return false;

  let matched = 0;
  for (const token of tokens) {
    if (noteContainsTerm(noteLower, token, phraseHits)) matched++;
  }

  const required =
    tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.7));
  return matched >= required;
}

const URGENCY_WORDS: { level: UrgencyLevel; pattern: RegExp }[] = [
  { level: "GREEN", pattern: /\b(non[- ]?urgent|routine|low priority|not urgent|green)\b/i },
  { level: "YELLOW", pattern: /\b(somewhat|yellow|mild)\b/i },
  { level: "ORANGE", pattern: /\b(orange|moderately|moderate|amber)\b/i },
  { level: "RED", pattern: /\b(urgent|same[- ]?day|emergency|red|high priority)\b/i },
];

const CONDITION_SPLIT = /\s*(?:should be|must be|treat(?:ed)? as|classif(?:y|ied) as|mark(?:ed)? as|→|->|=|:)\s*/i;

function normalizeCondition(text: string): string {
  return text
    .replace(/^[-*•]\s*/, "")
    .replace(/^all\s+/i, "")
    .replace(/^any\s+/i, "")
    .trim()
    .toLowerCase();
}

function detectUrgencyFromText(text: string): UrgencyLevel | null {
  for (const { level, pattern } of URGENCY_WORDS) {
    if (pattern.test(text)) return level;
  }
  return null;
}

export type ParsedRule = {
  condition: string;
  urgency: UrgencyLevel;
  line: string;
  seenWithinDays?: number;
};

export function parseSpecialistRules(rules: string): ParsedRule[] {
  const parsed: ParsedRule[] = [];
  let currentLevel: UrgencyLevel | null = null;
  let currentDays: number | undefined;

  for (const rawLine of rules.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = line.match(/^===\s*(RED|ORANGE|YELLOW|GREEN)\b/i);
    if (sectionMatch) {
      currentLevel = sectionMatch[1].toUpperCase() as UrgencyLevel;
      currentDays = undefined;
      continue;
    }

    const daysMatch = line.match(/Default wait for this tier:\s*(\d+)\s*days/i);
    if (daysMatch) {
      currentDays = parseInt(daysMatch[1], 10);
      continue;
    }

    const arrowMatch = line.match(/^[-*•]?\s*(.+?)\s*(?:→|->)\s*(RED|ORANGE|YELLOW|GREEN)\s*$/i);
    if (arrowMatch) {
      const condition = normalizeCondition(arrowMatch[1]);
      const urgency = arrowMatch[2].toUpperCase() as UrgencyLevel;
      if (condition) {
        parsed.push({ condition, urgency, line, seenWithinDays: currentDays });
        continue;
      }
    }

    const parts = line.split(CONDITION_SPLIT);
    if (parts.length >= 2) {
      const condition = normalizeCondition(parts[0]);
      const urgency = detectUrgencyFromText(parts.slice(1).join(" "));
      if (condition && urgency) {
        parsed.push({ condition, urgency, line, seenWithinDays: currentDays });
        continue;
      }
    }

    if (currentLevel && line.startsWith("-")) {
      const condition = normalizeCondition(line);
      if (condition.length >= 3) {
        parsed.push({
          condition: condition.replace(/\s*→\s*(red|orange|yellow|green)\s*$/i, "").trim(),
          urgency: currentLevel,
          line,
          seenWithinDays: currentDays,
        });
      }
    }
  }
  return parsed;
}

/** Match note against structured tier filter boxes (preferred) */
export function matchTierFilter(
  noteContent: string,
  tiers: SpecialistTierFilter
): ParsedRule | null {
  const candidates: ParsedRule[] = [];

  for (const level of ["RED", "ORANGE", "YELLOW", "GREEN"] as UrgencyLevel[]) {
    const tier = tiers[level];
    const days = parseTimeframeToDays(tier.timeframe, level);
    for (const rawLine of tier.rules.split("\n")) {
      const condition = normalizeCondition(rawLine);
      if (condition.length < 3) continue;
      if (!noteMatchesCondition(noteContent, condition)) continue;
      candidates.push({
        condition,
        urgency: level,
        line: `- ${rawLine.trim()} → ${level}`,
        seenWithinDays: days,
      });
    }
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.condition.length - a.condition.length)[0];
}

export function matchSpecialistRules(noteContent: string, rules: string): ParsedRule | null {
  const parsed = parseSpecialistRules(rules);
  let best: ParsedRule | null = null;
  for (const rule of parsed) {
    if (!noteMatchesCondition(noteContent, rule.condition)) continue;
    if (!best || rule.condition.length > best.condition.length) best = rule;
  }
  return best;
}

export function applySpecialistUrgencyOverride(
  noteContent: string,
  urgency: UrgencyLevel,
  priorityReason: string,
  specialistRules: string,
  tiers?: SpecialistTierFilter
): { urgency: UrgencyLevel; priorityReason: string; ruleApplied: string | null; seenWithinDays?: number } {
  const match = (tiers && matchTierFilter(noteContent, tiers)) || matchSpecialistRules(noteContent, specialistRules);
  if (!match) return { urgency, priorityReason, ruleApplied: null };

  return {
    urgency: match.urgency,
    priorityReason: `Per specialist triage rule: ${match.line}`,
    ruleApplied: match.line,
    seenWithinDays: match.seenWithinDays,
  };
}

export function specialistRulesGovernCase(
  noteContent: string,
  specialistRules: string,
  tiers?: SpecialistTierFilter
): boolean {
  return (
    (tiers ? matchTierFilter(noteContent, tiers) : null) !== null ||
    matchSpecialistRules(noteContent, specialistRules) !== null
  );
}
