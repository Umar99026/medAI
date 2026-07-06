/* global DocumentApp, SpreadsheetApp, PropertiesService, ScriptApp, UrlFetchApp, Utilities, Logger, Session */

const CONFIG = {
  PROJECT_NAME: "medAI Clinic Intake → Specialist Triage",
  TRIAGE_SHEET_NAME: "Triage",
  GEMINI_MODEL: "gemini-2.0-flash",
  GEMINI_ENDPOINT_BASE: "https://generativelanguage.googleapis.com/v1beta/models/",
};

const DOC_SUBMIT_MARKER = "[TRIAGE_SUBMIT]";
const DOC_PROCESSED_PREFIX = "[TRIAGE_PROCESSED:";

const TRIAGE_HEADERS = [
  "ReceivedAt",
  "PatientName",
  "DOB",
  "Sex",
  "Phone",
  "Email",
  "PresentingComplaint",
  "History",
  "Vitals",
  "Medications",
  "Allergies",
  "ClinicianAssessment",
  "ClinicianPlan",
  "RedFlags",
  "SuggestedSpecialty",
  "Priority",
  "AI_Summary",
  "GeminiConfidence",
  "SourceDocUrl",
];

const PRIORITY_COLORS = {
  RED: "#f8d7da",
  YELLOW: "#fff3cd",
  GREEN: "#d1e7dd",
};

/**
 * One-time setup (Google Doc → Gemini → Sheet):
 * - creates Spreadsheet
 * - creates a Google Doc template for intake notes
 * - creates Triage sheet + headers
 * - installs a time-driven trigger that scans the Doc periodically
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error('Missing Script Property "GEMINI_API_KEY". Add it in Project Settings → Script Properties.');
  }

  const spreadsheet = SpreadsheetApp.create(CONFIG.PROJECT_NAME + " (Triage)");
  const ssId = spreadsheet.getId();
  props.setProperty("SPREADSHEET_ID", ssId);

  const doc = DocumentApp.create(CONFIG.PROJECT_NAME + " (Patient Intake Note)");
  const docId = doc.getId();
  props.setProperty("DOC_ID", docId);
  props.deleteProperty("DOC_LAST_PROCESSED_HASH");

  seedDocTemplate_(doc);

  // Ensure Triage sheet exists and has headers.
  ensureTriageSheet_(spreadsheet);

  // Install (or reinstall) time-driven trigger to scan the doc.
  deleteExistingTriggers_();
  ScriptApp.newTrigger("scanIntakeDocAndAppend")
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("Setup complete.");
  Logger.log("Spreadsheet URL (specialist): %s", spreadsheet.getUrl());
  Logger.log("Intake Doc URL (clinic): %s", doc.getUrl());
  Logger.log('To submit a note: add a line containing %s in the Doc, then wait up to 5 minutes (or run scanIntakeDocAndAppend manually).', DOC_SUBMIT_MARKER);
}

/**
 * Periodic scanner: if the intake Doc has a submit marker and changed since last run,
 * classify with Gemini and append to the Triage sheet, then mark processed in the doc.
 */
function scanIntakeDocAndAppend() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty("SPREADSHEET_ID");
  const docId = props.getProperty("DOC_ID");
  if (!ssId || !docId) throw new Error("Missing SPREADSHEET_ID or DOC_ID. Run setup() first.");

  const ss = SpreadsheetApp.openById(ssId);
  const triageSheet = ensureTriageSheet_(ss);

  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  const text = body.getText() || "";

  if (text.indexOf(DOC_SUBMIT_MARKER) === -1) {
    return; // nothing to do
  }

  const hash = sha256Base64_(text);
  const lastHash = props.getProperty("DOC_LAST_PROCESSED_HASH") || "";
  if (hash === lastHash) {
    return; // unchanged since last processed
  }

  const receivedAt = new Date();
  const qa = [{ question: "Intake note (Google Doc)", answer: text }];
  const geminiResult = classifyWithGemini_({ receivedAt, qa });

  const rowObj = {
    ReceivedAt: formatDateTime_(receivedAt),
    PatientName: geminiResult.PatientName || "",
    DOB: geminiResult.DOB || "",
    Sex: geminiResult.Sex || "",
    Phone: geminiResult.Phone || "",
    Email: geminiResult.Email || "",
    PresentingComplaint: geminiResult.PresentingComplaint || "",
    History: geminiResult.History || "",
    Vitals: geminiResult.Vitals || "",
    Medications: geminiResult.Medications || "",
    Allergies: geminiResult.Allergies || "",
    ClinicianAssessment: geminiResult.ClinicianAssessment || "",
    ClinicianPlan: geminiResult.ClinicianPlan || "",
    RedFlags: geminiResult.RedFlags || "",
    SuggestedSpecialty: geminiResult.SuggestedSpecialty || "",
    Priority: normalizePriority_(geminiResult.Priority),
    AI_Summary: geminiResult.AI_Summary || "",
    GeminiConfidence: geminiResult.GeminiConfidence || "",
    SourceDocUrl: doc.getUrl(),
  };

  const row = TRIAGE_HEADERS.map((h) => rowObj[h] ?? "");
  const nextRow = triageSheet.getLastRow() + 1;
  triageSheet.getRange(nextRow, 1, 1, row.length).setValues([row]);

  colorRowByPriority_(triageSheet, nextRow, row.length, rowObj.Priority);

  markDocProcessed_(doc, rowObj.Priority);
  props.setProperty("DOC_LAST_PROCESSED_HASH", hash);
}

// ----------------------- Gemini integration -----------------------

function classifyWithGemini_({ receivedAt, qa }) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error('Missing Script Property "GEMINI_API_KEY".');

  const prompt = buildGeminiPrompt_({ receivedAt, qa });
  const url =
    CONFIG.GEMINI_ENDPOINT_BASE +
    encodeURIComponent(CONFIG.GEMINI_MODEL) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 600,
      responseMimeType: "application/json",
    },
  };

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const body = resp.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Gemini API error " + code + ": " + body);
  }

  const text = extractGeminiText_(body);
  const parsed = safeJsonParse_(text);
  return validateGeminiJson_(parsed);
}

function buildGeminiPrompt_({ receivedAt, qa }) {
  const qaText = qa.map((x) => `- ${x.question}: ${x.answer}`).join("\n");
  return [
    "You are a medical triage assistant helping route clinic referrals to a specialist.",
    "Use ONLY the information provided. If a field is missing, return an empty string for that field.",
    "",
    "Task:",
    "- Extract structured fields for a referral spreadsheet.",
    "- Determine Priority: RED (urgent), YELLOW (moderate), GREEN (fine).",
    "- Provide a concise AI_Summary suitable for a specialist.",
    "",
    "Priority guidance (general):",
    "- RED: severe symptoms, red flags, unstable vitals, high-risk presentation, rapid deterioration, or needs same-day review.",
    "- YELLOW: symptomatic and needs timely specialist review, but not immediately life-threatening.",
    "- GREEN: stable, routine referral / low acuity.",
    "",
    "Return STRICT JSON with exactly these keys:",
    JSON.stringify(
      {
        PatientName: "",
        DOB: "",
        Sex: "",
        Phone: "",
        Email: "",
        PresentingComplaint: "",
        History: "",
        Vitals: "",
        Medications: "",
        Allergies: "",
        ClinicianAssessment: "",
        ClinicianPlan: "",
        RedFlags: "",
        SuggestedSpecialty: "",
        Priority: "GREEN",
        AI_Summary: "",
        GeminiConfidence: "",
      },
      null,
      2
    ),
    "",
    "Submission received at: " + formatDateTime_(receivedAt),
    "Input:",
    qaText,
    "",
    "Important:",
    "- Output JSON only. No markdown. No code fences.",
    "- Priority must be exactly one of: RED, YELLOW, GREEN.",
  ].join("\n");
}

function extractGeminiText_(rawBody) {
  const parsed = JSON.parse(rawBody);
  const text =
    parsed &&
    parsed.candidates &&
    parsed.candidates[0] &&
    parsed.candidates[0].content &&
    parsed.candidates[0].content.parts &&
    parsed.candidates[0].content.parts[0] &&
    parsed.candidates[0].content.parts[0].text;
  if (!text) throw new Error("Unexpected Gemini response format: " + rawBody);
  return text;
}

function safeJsonParse_(s) {
  try {
    return JSON.parse(s);
  } catch (err) {
    // Sometimes models may include stray whitespace or BOM; retry trim.
    return JSON.parse(String(s).trim());
  }
}

function validateGeminiJson_(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Gemini returned non-object JSON.");
  const out = {};
  [
    "PatientName",
    "DOB",
    "Sex",
    "Phone",
    "Email",
    "PresentingComplaint",
    "History",
    "Vitals",
    "Medications",
    "Allergies",
    "ClinicianAssessment",
    "ClinicianPlan",
    "RedFlags",
    "SuggestedSpecialty",
    "Priority",
    "AI_Summary",
    "GeminiConfidence",
  ].forEach((k) => {
    out[k] = obj[k] == null ? "" : String(obj[k]);
  });
  out.Priority = normalizePriority_(out.Priority);
  return out;
}

// ----------------------- Sheets helpers -----------------------

function ensureTriageSheet_(ss) {
  let sheet = ss.getSheetByName(CONFIG.TRIAGE_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.TRIAGE_SHEET_NAME);

  // Set headers if empty or mismatched.
  const currentLastCol = sheet.getLastColumn();
  const hasHeaders = sheet.getLastRow() >= 1 && currentLastCol >= TRIAGE_HEADERS.length;

  if (!hasHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, TRIAGE_HEADERS.length).setValues([TRIAGE_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, TRIAGE_HEADERS.length);
  } else {
    const current = sheet.getRange(1, 1, 1, TRIAGE_HEADERS.length).getValues()[0];
    const mismatch = current.join("|") !== TRIAGE_HEADERS.join("|");
    if (mismatch) {
      sheet.getRange(1, 1, 1, TRIAGE_HEADERS.length).setValues([TRIAGE_HEADERS]);
    }
    sheet.setFrozenRows(1);
  }

  // Make Priority column width readable.
  const priIdx = TRIAGE_HEADERS.indexOf("Priority") + 1;
  if (priIdx > 0) sheet.setColumnWidth(priIdx, 110);

  return sheet;
}

function colorRowByPriority_(sheet, rowIndex, colCount, priority) {
  const p = normalizePriority_(priority);
  const color = PRIORITY_COLORS[p] || PRIORITY_COLORS.GREEN;
  sheet.getRange(rowIndex, 1, 1, colCount).setBackground(color);
}

function deleteExistingTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t) => {
    const handler = t.getHandlerFunction && t.getHandlerFunction();
    if (handler === "handleFormSubmit" || handler === "scanIntakeDocAndAppend") {
      ScriptApp.deleteTrigger(t);
    }
  });
}

// ----------------------- Utilities -----------------------

function normalizeAnswer_(a) {
  if (Array.isArray(a)) return a.join(", ");
  if (a == null) return "";
  return String(a);
}

function pickAnswer_(qa, questionPrefix) {
  const q = String(questionPrefix).toLowerCase();
  const hit = qa.find((x) => String(x.question).toLowerCase().indexOf(q) === 0);
  return hit ? hit.answer : "";
}

function normalizePriority_(p) {
  const v = String(p || "").trim().toUpperCase();
  if (v === "RED" || v === "YELLOW" || v === "GREEN") return v;
  return "GREEN";
}

function formatDateTime_(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function sha256Base64_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function seedDocTemplate_(doc) {
  const body = doc.getBody();
  body.clear();
  body.appendParagraph("Patient intake note (clinic)").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("");
  body
    .appendParagraph("When ready to send this note to the specialist spreadsheet, add this marker on its own line:")
    .setBold(true);
  body.appendParagraph(DOC_SUBMIT_MARKER).setBold(true);
  body.appendParagraph("");
  body.appendParagraph("Suggested structure (free text is fine):").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("Patient name:");
  body.appendParagraph("DOB:");
  body.appendParagraph("Sex:");
  body.appendParagraph("Phone / Email:");
  body.appendParagraph("");
  body.appendParagraph("Presenting complaint:");
  body.appendParagraph("History:");
  body.appendParagraph("Vitals:");
  body.appendParagraph("Medications:");
  body.appendParagraph("Allergies:");
  body.appendParagraph("Clinician assessment:");
  body.appendParagraph("Clinician plan / reason for referral:");
}

function markDocProcessed_(doc, priority) {
  const body = doc.getBody();
  const text = body.getText() || "";
  const now = formatDateTime_(new Date());
  const tag = String(DOC_PROCESSED_PREFIX) + String(now) + "|" + String(normalizePriority_(priority)) + "]";

  if (text.indexOf(DOC_SUBMIT_MARKER) === -1) return;
  if (text.indexOf(DOC_PROCESSED_PREFIX) !== -1) {
    // Remove any old submit markers but keep the processed tag history.
    body.replaceText(escapeForDocReplace_(DOC_SUBMIT_MARKER), "");
    return;
  }

  // Replace the first submit marker with a processed tag.
  body.replaceText(escapeForDocReplace_(DOC_SUBMIT_MARKER), tag);
}

function escapeForDocReplace_(literal) {
  // DocumentApp.replaceText treats the first arg as regex.
  // Avoid regex-literal escaping here (some editors mis-highlight nested [] patterns).
  const s = String(literal);
  const specials = new Set(["\\", ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += specials.has(ch) ? "\\" + ch : ch;
  }
  return out;
}

