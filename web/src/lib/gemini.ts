import {
  keywordClassifyReasoning,
  keywordClassifySpecialties,
  matchSpecialtyToKeywords,
  extractUrgencyReason,
  isGenericPriorityReason,
} from "./keywordTriage";
import { SPECIALTIES } from "./specialties";
import {
  applySpecialistUrgencyOverride,
  matchSpecialistRules,
  matchTierFilter,
  specialistRulesGovernCase,
} from "./specialistUrgency";
import { tierDaysFromCompiledRules } from "./specialistFilter";
import type { SpecialistTierFilter } from "./specialistTierFilter";
import {
  defaultSeenWithinDays,
  normalizeSeenWithinDays,
  normalizeUrgency,
  type UrgencyLevel,
} from "./urgency";

const URGENCY_CLASSIFICATION_GUIDE = [
  "Urgency levels (4-tier, most to least urgent):",
  "- RED: pretty urgent — patient should be seen within days (seenWithinDays: 0–3)",
  "- ORANGE: moderately urgent — seen within about a week (seenWithinDays: 4–10)",
  "- YELLOW: somewhat urgent — seen within a few weeks (seenWithinDays: 11–28)",
  "- GREEN: not urgent at all — routine wait of several weeks (seenWithinDays: 29–84)",
  "",
  "Also set seenWithinDays: integer — recommended maximum days until the patient should be seen.",
  "Pick a specific number of days or whole weeks (as days) based on clinical context.",
].join("\n");

export type SpecialtyClassification = {
  suggestedSpecialties: string[];
  reasoning: string;
};

export type StructuredReferral = {
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
  confidence: string;
};

const MODEL = "gemini-2.0-flash";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(`${URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Gemini error: ${body}`);

  const parsed = JSON.parse(body);
  const text =
    parsed?.candidates?.[0]?.content?.parts?.[0]?.text ??
    parsed?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("");

  return String(text).trim();
}

function normalizeSpecialtyNames(names: string[]): string[] {
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    const exact = SPECIALTIES.find((s) => s.toLowerCase() === lower);
    if (exact) {
      if (!result.includes(exact)) result.push(exact);
      continue;
    }
    const partial = SPECIALTIES.find(
      (s) =>
        s.toLowerCase().includes(lower) ||
        lower.includes(s.toLowerCase()) ||
        s.toLowerCase().split(/[\s&(]+/)[0] === lower.split(/[\s&(]+/)[0]
    );
    if (partial && !result.includes(partial)) result.push(partial);
  }
  return result.slice(0, 3);
}

/** Step 1: GP clicks Refer — ask Gemini which specialist type is needed */
export async function classifySpecialtyTypes(noteContent: string): Promise<SpecialtyClassification> {
  const keywordHits = keywordClassifySpecialties(noteContent);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      suggestedSpecialties: keywordHits,
      reasoning: keywordClassifyReasoning(noteContent, keywordHits),
    };
  }

  const prompt = [
    "What type of specialist is needed for this clinical issue?",
    "",
    "Read the GP note or referral letter and decide which medical specialty should receive this referral.",
    "",
    `Choose from these specialties only: ${SPECIALTIES.join(", ")}`,
    "",
    "Return STRICT JSON only:",
    '{"suggestedSpecialties":["Cardiology"],"reasoning":"Brief explanation in one or two sentences"}',
    "",
    "Rules:",
    "- suggestedSpecialties: 1 primary specialty (add a 2nd only if genuinely needed)",
    "- Use exact specialty names from the list above",
    "",
    "Clinical text:",
    noteContent,
  ].join("\n");

  try {
    const text = await callGemini(prompt);
    const data = JSON.parse(text);
    const raw = Array.isArray(data.suggestedSpecialties)
      ? data.suggestedSpecialties.map(String)
      : data.suggestedSpecialty
        ? [String(data.suggestedSpecialty)]
        : [];

    const normalized = normalizeSpecialtyNames(raw);
    return {
      suggestedSpecialties: normalized.length > 0 ? normalized : keywordHits,
      reasoning:
        String(data.reasoning || "").trim() ||
        (normalized.length > 0
          ? `Specialist type identified: ${normalized.join(", ")}.`
          : keywordClassifyReasoning(noteContent, keywordHits)),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("classifySpecialtyTypes Gemini failed:", msg);
    return {
      suggestedSpecialties: keywordHits,
      reasoning: `AI classification unavailable (${msg}). Showing keyword-based guess: ${keywordHits.join(", ")}.`,
    };
  }
}

/** Specialist-specific urgency — rules override all default medical triage */
export async function classifyUrgencyPerSpecialistRules(
  noteContent: string,
  specialistRules: string,
  tiers?: SpecialistTierFilter
): Promise<{ urgency: UrgencyLevel; seenWithinDays: number; priorityReason: string; ruleApplied: string | null }> {
  const tierMatch = tiers ? matchTierFilter(noteContent, tiers) : null;
  const deterministic = tierMatch || matchSpecialistRules(noteContent, specialistRules);
  if (deterministic) {
    const tierDays =
      deterministic.seenWithinDays ??
      tierDaysFromCompiledRules(specialistRules, deterministic.urgency) ??
      defaultSeenWithinDays(deterministic.urgency);
    return {
      urgency: deterministic.urgency,
      seenWithinDays: tierDays,
      priorityReason: `Per specialist triage rule: ${deterministic.line}`,
      ruleApplied: deterministic.line,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallback = applySpecialistUrgencyOverride(noteContent, "GREEN", "", specialistRules, tiers);
    const urgency = fallback.urgency;
    return {
      urgency,
      seenWithinDays: defaultSeenWithinDays(urgency),
      priorityReason:
        fallback.priorityReason || "No matching specialist rule — routine per practice defaults.",
      ruleApplied: fallback.ruleApplied,
    };
  }

  const prompt = [
    "You classify GP referral urgency for ONE specific specialist practice.",
    "",
    "CRITICAL RULES:",
    "1. The specialist's custom triage rules below OVERRIDE standard medical defaults.",
    "2. Match SEMANTICALLY — e.g. 'exertion' matches 'activity', 'exercise'; 'chest discomfort' matches 'chest pain'.",
    "3. If a rule assigns YELLOW/ORANGE/RED to a presentation, use that tier even if the word 'stable' appears.",
    "4. 'Stable' in a rule name does NOT mean GREEN — follow the tier colour on the rule line.",
    "5. Pick the MOST SPECIFIC matching rule (longest condition match wins).",
    "6. Cite the exact rule you applied in priorityReason.",
    "",
    URGENCY_CLASSIFICATION_GUIDE,
    "",
    specialistRules.trim(),
    "",
    "Return STRICT JSON only:",
    '{"urgency":"RED|ORANGE|YELLOW|GREEN","seenWithinDays":21,"priorityReason":"Which rule matched (semantic) and why"}',
    "",
    "Clinical referral text:",
    noteContent,
  ].join("\n");

  try {
    const text = await callGemini(prompt);
    const data = JSON.parse(text);
    const urgency = normalizeUrgency(data.urgency);
    const seenWithinDays = normalizeSeenWithinDays(data.seenWithinDays, urgency);
    let priorityReason = String(data.priorityReason || "").trim();
    if (!priorityReason) {
      priorityReason = `Classified per specialist practice rules (${urgency}).`;
    }

    const enforced = applySpecialistUrgencyOverride(
      noteContent,
      urgency,
      priorityReason,
      specialistRules,
      tiers
    );
    const finalUrgency = enforced.urgency;
    const tierDays =
      enforced.seenWithinDays ??
      tierDaysFromCompiledRules(specialistRules, finalUrgency) ??
      (enforced.ruleApplied ? defaultSeenWithinDays(finalUrgency) : seenWithinDays);
    return {
      urgency: finalUrgency,
      seenWithinDays: tierDays,
      priorityReason: enforced.ruleApplied ? enforced.priorityReason : priorityReason,
      ruleApplied: enforced.ruleApplied,
    };
  } catch {
    const fallback = applySpecialistUrgencyOverride(
      noteContent,
      "GREEN",
      "Classified per specialist practice defaults.",
      specialistRules,
      tiers
    );
    return {
      urgency: fallback.urgency,
      seenWithinDays: defaultSeenWithinDays(fallback.urgency),
      priorityReason: fallback.priorityReason,
      ruleApplied: fallback.ruleApplied,
    };
  }
}

/** Step 2: GP picks specialist — full extraction + urgency */
export async function extractStructuredReferral(
  noteContent: string,
  specialistRules?: string,
  tiers?: SpecialistTierFilter
): Promise<StructuredReferral> {
  const keywordSpecs = keywordClassifySpecialties(noteContent);
  const rules = specialistRules?.trim() || "";
  const apiKey = process.env.GEMINI_API_KEY;

  let specialistUrgency: {
    urgency: UrgencyLevel;
    seenWithinDays: number;
    priorityReason: string;
    ruleApplied: string | null;
  } | null = null;
  if (rules) {
    specialistUrgency = await classifyUrgencyPerSpecialistRules(noteContent, rules, tiers);
  }

  if (!apiKey) {
    const result = fallbackStructured(noteContent, keywordSpecs, rules, tiers);
    if (specialistUrgency) {
      result.urgency = specialistUrgency.urgency;
      result.seenWithinDays = specialistUrgency.seenWithinDays;
      result.priorityReason = specialistUrgency.priorityReason;
    }
    return result;
  }

  const rulesBlock = rules
    ? [
        "",
        "CRITICAL — Specialist triage rules (OVERRIDE standard medical urgency defaults):",
        rules,
        specialistUrgency
          ? `Pre-classified: urgency=${specialistUrgency.urgency}, seenWithinDays=${specialistUrgency.seenWithinDays}. You MUST use these values. Reason: ${specialistUrgency.priorityReason}`
          : "",
        "Do NOT re-classify urgency using general medical triage when specialist rules are present.",
      ].join("\n")
    : "";

  const prompt = [
    "You are a clinical referral assistant. Extract structured referral data from the note/letter.",
    "Return STRICT JSON only (no markdown).",
    "",
    "Tasks:",
    "1) Extract all patient and clinical fields present in the text.",
    rules
      ? "2) Use the pre-classified urgency and seenWithinDays from specialist rules. Do NOT override."
      : `2) Assign urgency and seenWithinDays using this guide:\n${URGENCY_CLASSIFICATION_GUIDE}`,
    "3) Write priorityReason (1-3 bullets, newline separated) explaining urgency and recommended wait.",
    "4) Write aiSummary — concise specialist-facing summary (max 6 lines).",
    "5) suggestedSpecialty — primary specialty type for this referral.",
    rulesBlock,
    "",
    "Use empty string for missing fields. Do not invent facts.",
    "",
    "Return JSON keys:",
    JSON.stringify(
      {
        patientName: "",
        dob: "",
        sex: "",
        phone: "",
        email: "",
        presentingComplaint: "",
        history: "",
        vitals: "",
        medications: "",
        allergies: "",
        redFlags: "",
        suggestedSpecialty: "",
        urgency: specialistUrgency?.urgency ?? "GREEN",
        seenWithinDays: specialistUrgency?.seenWithinDays ?? 56,
        priorityReason: specialistUrgency?.priorityReason ?? "",
        aiSummary: "",
        confidence: "",
      },
      null,
      2
    ),
    "",
    "Clinical text:",
    noteContent,
  ].join("\n");

  try {
    const text = await callGemini(prompt);
    const result = validateStructured(JSON.parse(text), noteContent, rules, tiers);
    if (!result.suggestedSpecialty) {
      result.suggestedSpecialty = keywordSpecs[0];
    }
    if (specialistUrgency) {
      result.urgency = specialistUrgency.urgency;
      result.seenWithinDays = specialistUrgency.seenWithinDays;
      result.priorityReason = specialistUrgency.priorityReason;
    } else if (rules) {
      const override = applySpecialistUrgencyOverride(
        noteContent,
        result.urgency,
        result.priorityReason,
        rules,
        tiers
      );
      result.urgency = override.urgency;
      if (override.ruleApplied) {
        result.priorityReason = override.priorityReason;
        if (override.seenWithinDays) result.seenWithinDays = override.seenWithinDays;
      }
    }
    return result;
  } catch {
    const result = fallbackStructured(noteContent, keywordSpecs, rules, tiers);
    if (specialistUrgency) {
      result.urgency = specialistUrgency.urgency;
      result.seenWithinDays = specialistUrgency.seenWithinDays;
      result.priorityReason = specialistUrgency.priorityReason;
    }
    return result;
  }
}

/** Merge specialist edits into persistent rule memory — returns full rule set + change summary */
export type RuleMemorySync = {
  rules: string;
  changes: string;
};

export async function syncSpecialistRuleMemory(opts: {
  existingMemory: string;
  previousInstructions: string;
  newInstructions: string;
  documentText: string;
}): Promise<RuleMemorySync> {
  const existingMemory = opts.existingMemory.trim();
  const previousInstructions = opts.previousInstructions.trim();
  const newInstructions = opts.newInstructions.trim();
  const documentText = opts.documentText.trim();

  if (!newInstructions && !documentText && !existingMemory) {
    return { rules: "", changes: "" };
  }

  if (!newInstructions && !documentText) {
    return { rules: existingMemory, changes: "No new edits — memory unchanged." };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const rules = mergeRulesFallback(existingMemory, newInstructions, documentText);
    return {
      rules,
      changes: existingMemory
        ? "Merged edits locally (AI unavailable)."
        : "Initial rules saved locally (AI unavailable).",
    };
  }

  const prompt = [
    "You are the memory system for a specialist's GP referral triage rules.",
    "You maintain a complete, canonical list of ALL active rules. This memory is used like an LLM knowledge store.",
    "",
    "Each rule line MUST use this exact format:",
    "- <clinical condition or symptom phrase> → RED|ORANGE|YELLOW|GREEN",
    "",
    "RED = within days, ORANGE = ~1 week, YELLOW = few weeks, GREEN = routine/non-urgent.",
    "",
    "CURRENT RULE MEMORY (all active rules — preserve unless changed or removed):",
    existingMemory || "(empty — first time setup)",
    "",
    previousInstructions && previousInstructions !== newInstructions
      ? `PREVIOUS USER INSTRUCTIONS (already merged into memory):\n${previousInstructions}`
      : "",
    "",
    "NEW USER INSTRUCTIONS (may add rules, change urgency, or remove/replace rules):",
    newInstructions || "(no new typed instructions — check documents only)",
    "",
    documentText ? `UPLOADED GUIDELINES / DOCUMENTS:\n${documentText.slice(0, 12000)}` : "",
    "",
    "Your tasks:",
    "1. Compare new instructions (and documents) against current memory.",
    "2. ADD any new conditions mentioned.",
    "3. UPDATE rules when the user changes urgency (e.g. chest pain RED → GREEN).",
    "4. REMOVE rules the user explicitly deletes or contradicts.",
    "5. KEEP all unchanged rules — output the COMPLETE updated memory, not just diffs.",
    "6. Do NOT drop existing rules unless the user clearly removed or replaced them.",
    "7. Resolve conflicts in favour of the NEW instructions.",
    "",
    "Return STRICT JSON only:",
    '{"rules":"Every active rule, one per line, each starting with -","changes":"Brief bullet summary of what was added, updated, or removed"}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const text = await callGemini(prompt);
    const data = JSON.parse(text);
    const rules = normalizeRuleMemory(String(data.rules || ""));
    const changes = String(data.changes || "Memory updated.").trim();
    if (rules) return { rules, changes };
  } catch {
    /* fall through */
  }

  const rules = mergeRulesFallback(existingMemory, newInstructions, documentText);
  return {
    rules,
    changes: existingMemory ? "Memory merged with fallback parser." : "Initial rules created.",
  };
}

/** @deprecated Use syncSpecialistRuleMemory — kept for compatibility */
export async function processSpecialistUrgencyRules(
  instructions: string,
  documentText: string
): Promise<string> {
  const { rules } = await syncSpecialistRuleMemory({
    existingMemory: "",
    previousInstructions: "",
    newInstructions: instructions,
    documentText,
  });
  return rules;
}

function normalizeRuleMemory(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("-") ? line : `- ${line}`))
    .join("\n");
}

function mergeRulesFallback(existingMemory: string, newInstructions: string, documentText: string): string {
  const incoming = formatRulesFallback(
    [newInstructions, documentText].filter(Boolean).join("\n\n---\n\n")
  );
  if (!existingMemory) return incoming;
  if (!incoming) return existingMemory;

  const existingLines = existingMemory.split("\n").map((l) => l.trim()).filter(Boolean);
  const incomingLines = incoming.split("\n").map((l) => l.trim()).filter(Boolean);

  const conditionKey = (line: string) =>
    line.replace(/^-\s*/, "").split(/→|->|=/)[0]?.trim().toLowerCase() || line.toLowerCase();

  const byCondition = new Map<string, string>();
  for (const line of existingLines) byCondition.set(conditionKey(line), line);
  for (const line of incomingLines) byCondition.set(conditionKey(line), line);

  return [...byCondition.values()].join("\n");
}

function formatRulesFallback(combined: string): string {
  return combined
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("-") ? line : `- ${line}`))
    .join("\n")
    .slice(0, 4000);
}

export function matchSpecialty(specialistSpecialty: string | null | undefined, suggested: string[]) {
  return matchSpecialtyToKeywords(specialistSpecialty, suggested);
}

function validateStructured(
  data: Record<string, unknown>,
  noteContent: string,
  specialistRules?: string,
  tiers?: SpecialistTierFilter
): StructuredReferral {
  const hasSpecialistRules = Boolean(specialistRules?.trim());
  const urgency = normalizeUrgency(data.urgency);
  const seenWithinDays = normalizeSeenWithinDays(data.seenWithinDays, urgency);
  let priorityReason = String(data.priorityReason || "");
  if (
    !hasSpecialistRules &&
    isGenericPriorityReason(priorityReason)
  ) {
    priorityReason = extractUrgencyReason(noteContent, urgency);
  }

  const result: StructuredReferral = {
    patientName: String(data.patientName || "Unknown patient"),
    dob: String(data.dob || ""),
    sex: String(data.sex || ""),
    phone: String(data.phone || ""),
    email: String(data.email || ""),
    presentingComplaint: String(data.presentingComplaint || ""),
    history: String(data.history || ""),
    vitals: String(data.vitals || ""),
    medications: String(data.medications || ""),
    allergies: String(data.allergies || ""),
    redFlags: String(data.redFlags || ""),
    suggestedSpecialty: String(data.suggestedSpecialty || "General Medicine"),
    urgency,
    seenWithinDays,
    priorityReason,
    aiSummary: String(data.aiSummary || ""),
    confidence: String(data.confidence || "medium"),
  };

  if (specialistRules?.trim()) {
    const override = applySpecialistUrgencyOverride(
      noteContent,
      result.urgency,
      result.priorityReason,
      specialistRules,
      tiers
    );
    if (override.ruleApplied) {
      result.urgency = override.urgency;
      result.seenWithinDays = override.seenWithinDays ?? defaultSeenWithinDays(override.urgency);
      result.priorityReason = override.priorityReason;
    }
  }

  return result;
}

function fallbackStructured(
  noteContent: string,
  keywordSpecs: string[],
  specialistRules?: string,
  tiers?: SpecialistTierFilter
): StructuredReferral {
  const lower = noteContent.toLowerCase();
  let urgency: UrgencyLevel = "GREEN";
  let priorityReason = "";
  let seenWithinDays = defaultSeenWithinDays("GREEN");

  if (specialistRules?.trim() || tiers) {
    const match =
      (tiers && matchTierFilter(noteContent, tiers)) ||
      (specialistRules ? matchSpecialistRules(noteContent, specialistRules) : null);
    if (match) {
      urgency = match.urgency;
      seenWithinDays = match.seenWithinDays ?? defaultSeenWithinDays(match.urgency);
      priorityReason = `Per specialist triage rule: ${match.line}`;
    }
  }

  if (!priorityReason && !specialistRulesGovernCase(noteContent, specialistRules || "", tiers)) {
    if (/chest pain|severe|unstable|emergency|syncope|haemorrhage|hemorrhage/.test(lower)) urgency = "RED";
    else if (/worsening|deteriorat/.test(lower)) urgency = "ORANGE";
    else if (/pain|fever|urgent/.test(lower)) urgency = "YELLOW";
    priorityReason = extractUrgencyReason(noteContent, urgency);
  } else if (!priorityReason) {
    priorityReason = extractUrgencyReason(noteContent, urgency);
  }

  if (seenWithinDays === defaultSeenWithinDays("GREEN") && urgency !== "GREEN") {
    seenWithinDays = defaultSeenWithinDays(urgency);
  }

  return {
    patientName: "Unknown patient",
    dob: "",
    sex: "",
    phone: "",
    email: "",
    presentingComplaint: noteContent.slice(0, 200),
    history: "",
    vitals: "",
    medications: "",
    allergies: "",
    redFlags: "",
    suggestedSpecialty: keywordSpecs[0],
    urgency,
    seenWithinDays,
    priorityReason: priorityReason || extractUrgencyReason(noteContent, urgency),
    aiSummary: noteContent.slice(0, 500),
    confidence: "low",
  };
}
