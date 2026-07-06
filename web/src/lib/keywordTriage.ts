import { SPECIALTIES } from "./specialties";
import type { UrgencyLevel } from "./urgency";

/** Keyword → specialty mapping for local triage when Gemini is slow/unavailable */
const KEYWORD_MAP: { specialty: string; patterns: RegExp[] }[] = [
  { specialty: "Cardiology", patterns: [/cardio|heart|chest pain|palpitation|angina|ecg|ekg|troponin|arrhythmia|murmur|hypertension/i] },
  { specialty: "Dermatology", patterns: [/dermat|skin|rash|eczema|psoriasis|lesion|mole|acne|urticaria|itch/i] },
  { specialty: "Orthopaedics", patterns: [/orthop|fracture|joint|knee|hip|shoulder|spine|back pain|arthritis|ligament|sprain/i] },
  { specialty: "Psychiatry", patterns: [/psych|mental|anxiety|depress|suicid|mood|bipolar|schizo|panic|ptsd/i] },
  { specialty: "Respiratory Medicine", patterns: [/respirat|lung|asthma|copd|dyspn|breath|wheeze|pneumonia|cough/i] },
  { specialty: "Gastroenterology", patterns: [/gastro|stomach|bowel|gi |colon|liver|hepat|reflux|ibd|crohn|diarrh|constipat/i] },
  { specialty: "Neurology", patterns: [/neuro|seizure|stroke|migraine|headache|epilep|numbness|weakness|tremor|multiple sclerosis/i] },
  { specialty: "Endocrinology", patterns: [/endocrin|diabet|thyroid|hormon|hba1c|insulin|glucose|adrenal/i] },
  { specialty: "Nephrology", patterns: [/nephro|kidney|renal|proteinuria|creatinine|dialysis/i] },
  { specialty: "Urology", patterns: [/urolog|prostate|bladder|urinar|kidney stone|haematuria|hematuria/i] },
  { specialty: "Rheumatology", patterns: [/rheumat|lupus|gout|autoimmune|joint pain|ra |sle/i] },
  { specialty: "Haematology", patterns: [/haemat|hemat|anaemia|anemia|clot|bleed|platelet|leukaemia|leukemia/i] },
  { specialty: "Oncology", patterns: [/oncolog|cancer|tumou?r|malignan|chemo|metastas/i] },
  { specialty: "Ophthalmology", patterns: [/ophthal|eye|vision|retina|glaucoma|cataract/i] },
  { specialty: "Otolaryngology (ENT)", patterns: [/\bent\b|ear nose|sinus|tonsil|hearing|throat/i] },
  { specialty: "Paediatrics", patterns: [/paediat|pediat|child|infant|newborn|toddler/i] },
  { specialty: "Gynaecology", patterns: [/gynaec|gynec|ovarian|uterine|menstrual|pelvic/i] },
  { specialty: "Obstetrics", patterns: [/obstet|pregnan|antenatal|labour|labor|fetal/i] },
  { specialty: "General Surgery", patterns: [/surg|appendic|hernia|gallstone|cholecyst/i] },
  { specialty: "Vascular Surgery", patterns: [/vascular|aneurysm|varicose|dvt|claudication/i] },
  { specialty: "Emergency Medicine", patterns: [/emergency|trauma|acute|resus/i] },
  { specialty: "General Medicine", patterns: [/general|gp referral|routine|check.?up/i] },
];

export function keywordClassifySpecialties(noteContent: string): string[] {
  const text = noteContent.toLowerCase();
  const scores: Record<string, number> = {};

  for (const { specialty, patterns } of KEYWORD_MAP) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores[specialty] = (scores[specialty] || 0) + 1;
      }
    }
  }

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  if (ranked.length > 0) return ranked.slice(0, 3);

  // No keyword hit — default so specialists still appear
  return ["General Medicine"];
}

export function keywordClassifyReasoning(noteContent: string, specialties: string[]): string {
  const hits = specialties.filter((s) => {
    const entry = KEYWORD_MAP.find((k) => k.specialty === s);
    return entry?.patterns.some((p) => p.test(noteContent));
  });
  if (hits.length > 0) {
    return `Keywords in the note suggest: ${hits.join(", ")}.`;
  }
  return `No strong keyword match — showing ${specialties[0]} specialists as default.`;
}

export function matchSpecialtyToKeywords(
  specialistSpecialty: string | null | undefined,
  suggested: string[]
): boolean {
  if (!specialistSpecialty) return false;
  const s = specialistSpecialty.toLowerCase();
  return suggested.some((x) => {
    const t = x.toLowerCase();
    if (s.includes(t) || t.includes(s)) return true;
    // Partial word match e.g. "Cardio" in Cardiology
    const sWords = s.split(/[\s(]+/);
    const tWords = t.split(/[\s(]+/);
    return sWords.some((sw) => tWords.some((tw) => sw.startsWith(tw.slice(0, 5)) || tw.startsWith(sw.slice(0, 5))));
  });
}

export { SPECIALTIES };

/** Clinical phrases detected in the note — used for urgency reasons shown to specialists */
const URGENCY_PHRASES: { level: UrgencyLevel; label: string; pattern: RegExp }[] = [
  { level: "RED", label: "chest pain", pattern: /chest pain/i },
  { level: "RED", label: "heart palpitations", pattern: /palpitat/i },
  { level: "RED", label: "shortness of breath", pattern: /shortness of breath|dyspn|breathless/i },
  { level: "RED", label: "syncope", pattern: /syncope|fainted|collapse/i },
  { level: "RED", label: "severe symptoms", pattern: /\bsevere\b/i },
  { level: "RED", label: "unstable symptoms", pattern: /unstable/i },
  { level: "RED", label: "emergency presentation", pattern: /emergency|resus/i },
  { level: "RED", label: "active bleeding", pattern: /haemorrhage|hemorrhage|bleeding/i },
  { level: "ORANGE", label: "worsening symptoms", pattern: /worsening|deteriorat/i },
  { level: "ORANGE", label: "significant pain", pattern: /significant pain|severe pain/i },
  { level: "YELLOW", label: "pain", pattern: /\bpain\b/i },
  { level: "YELLOW", label: "fever", pattern: /fever|pyrexia/i },
  { level: "YELLOW", label: "urgent concern", pattern: /\burgent\b/i },
];

export function extractUrgencyReason(
  noteContent: string,
  urgency: UrgencyLevel
): string {
  const text = noteContent.trim();
  if (!text) return urgency === "GREEN" ? "Routine referral." : "Clinical review requested.";

  const levelOrder: Record<UrgencyLevel, UrgencyLevel[]> = {
    RED: ["RED"],
    ORANGE: ["RED", "ORANGE"],
    YELLOW: ["RED", "ORANGE", "YELLOW"],
    GREEN: ["YELLOW"],
  };
  const allowed = new Set(levelOrder[urgency]);

  const matches: string[] = [];
  for (const { level, label, pattern } of URGENCY_PHRASES) {
    if (!allowed.has(level)) continue;
    if (pattern.test(text) && !matches.includes(label)) matches.push(label);
  }

  if (matches.length > 0) {
    const joined = matches.slice(0, 3).join(", ");
    if (urgency === "RED") return `Urgent: ${joined}`;
    if (urgency === "ORANGE") return `Moderately urgent: ${joined}`;
    if (urgency === "YELLOW") return `Somewhat urgent: ${joined}`;
    return joined;
  }

  const firstLine = text.split(/\n/)[0]?.trim() || text;
  const snippet = firstLine.slice(0, 100).trim();
  if (snippet.length >= 10) return snippet;

  if (urgency === "RED") return "Urgent clinical concern noted in referral.";
  if (urgency === "ORANGE") return "Symptoms warrant review within about a week.";
  if (urgency === "YELLOW") return "Symptoms warrant review within a few weeks.";
  return "Routine referral — no acute red flags noted.";
}

export function isGenericPriorityReason(reason: string): boolean {
  const r = reason.trim().toLowerCase();
  return (
    !r ||
    r.includes("keyword rule") ||
    r.includes("classified using") ||
    r === "n/a" ||
    r === "none"
  );
}
