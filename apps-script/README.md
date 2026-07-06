# medAI clinic → specialist triage automation (Google Doc + Gemini + Sheet)

This folder contains a Google Apps Script project that:

- Creates a **Google Doc** template for clinic intake notes
- Creates a **Google Spreadsheet**
- Periodically scans the Doc and, when it’s “submitted”, calls **Gemini API** to:
  - extract structured patient info
  - assign a **priority**: `RED` (urgent), `YELLOW` (moderate), `GREEN` (fine)
  - write a new row into a `Triage` sheet
  - color the **entire row** by priority

## What you’ll get

- A Google Doc (intake note template)
- A Google Spreadsheet with:
  - `Triage` (structured + color-coded for the specialist)

## Setup (recommended: standalone Apps Script)

1. Open `https://script.google.com` and create a **New project**.
2. Create files:
   - `Code.gs` (copy from `apps-script/Code.gs`)
   - `appsscript.json` (copy from `apps-script/appsscript.json`)
3. In Apps Script, open **Project Settings** → **Script Properties** and add:
   - `GEMINI_API_KEY` = your Gemini API key
4. Run the function `setup()` once.
   - Approve permissions when prompted.
5. After `setup()` finishes, check the Logs:
   - it prints the **Intake Doc URL** (for clinic staff)
   - it prints the **Spreadsheet URL** (for specialist)

## How submission works (Doc)

- In the intake Google Doc, when the note is ready, add a line containing:
  - `[TRIAGE_SUBMIT]`
- The script runs every ~5 minutes and will:
  - append the triaged row to the spreadsheet
  - replace `[TRIAGE_SUBMIT]` with a processed tag like `[TRIAGE_PROCESSED:2026-07-02 18:40:00|RED]`

## Notes / customization

- The Gemini call is designed to return **strict JSON** so the sheet can be filled reliably.
- If you want different columns, edit `TRIAGE_HEADERS` in `Code.gs`.
- Priority colors are set in `PRIORITY_COLORS` in `Code.gs`.

## Basic troubleshooting

- If Gemini errors: confirm `GEMINI_API_KEY` exists and the key has access to the model.
- If the trigger doesn’t run: rerun `setup()` (it recreates the installable trigger).
- If you changed the note format: update the prompt in `buildGeminiPrompt_()`.
