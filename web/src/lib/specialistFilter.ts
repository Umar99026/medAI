import { prisma } from "@/lib/prisma";
import type { UrgencyLevel } from "./urgency";
import {
  compileTierRules,
  parseTimeframeToDays,
  parseStoredTierConfig,
  type SpecialistTierFilter,
} from "./specialistTierFilter";

export type { SpecialistTierFilter, TierInput } from "./specialistTierFilter";
export {
  DEFAULT_TIER_FILTER,
  TIER_UI,
  compileTierRules,
  normalizeTierFilter,
  parseTimeframeToDays,
  parseStoredTierConfig,
} from "./specialistTierFilter";

/** Days from compiled tier section, e.g. "Default wait for this tier: 14 days" */
export function tierDaysFromCompiledRules(rules: string, level: UrgencyLevel): number | null {
  const re = new RegExp(
    `=== ${level}[\\s\\S]*?Default wait for this tier:\\s*(\\d+)\\s*days`,
    "i"
  );
  const m = rules.match(re);
  return m ? parseInt(m[1], 10) : null;
}

/** Specialist triage rules compiled from tier boxes */
export async function getSpecialistRulesContext(specialistId: string): Promise<{
  tiers: SpecialistTierFilter;
  memory: string;
  prompt: string;
}> {
  const { tiers, compiledRules } = await getSpecialistTierFilter(specialistId);
  const memory = compiledRules.trim();
  return {
    tiers,
    memory,
    prompt: buildSpecialistRulesPrompt(memory),
  };
}

/** @deprecated use getSpecialistRulesContext */
export async function getSpecialistRuleMemory(specialistId: string): Promise<string> {
  const { memory } = await getSpecialistRulesContext(specialistId);
  return memory;
}

export async function getSpecialistTierFilter(specialistId: string): Promise<{
  tiers: SpecialistTierFilter;
  compiledRules: string;
  updatedAt: Date | null;
}> {
  const filter = await prisma.specialistUrgencyFilter.findUnique({
    where: { specialistId },
  });
  const tiers = parseStoredTierConfig(filter);
  const compiledRules = compileTierRules(tiers);
  return { tiers, compiledRules, updatedAt: filter?.updatedAt ?? null };
}

/** Format rule memory for Gemini urgency classification on referral */
export function buildSpecialistRulesPrompt(rules: string): string {
  const trimmed = rules.trim();
  if (!trimmed) return "";
  return [
    "=== SPECIALIST TRIAGE RULES (follow exactly — override standard medical defaults) ===",
    "Each rule line maps a condition to an urgency color and timeframe.",
    "When a rule matches, use that urgency AND the tier's default wait time unless clinical context suggests sooner.",
    "",
    trimmed,
  ].join("\n");
}

/** @deprecated use getSpecialistRuleMemory */
export async function getSpecialistUrgencyRules(specialistId: string): Promise<string> {
  const rules = await getSpecialistRuleMemory(specialistId);
  return buildSpecialistRulesPrompt(rules);
}
