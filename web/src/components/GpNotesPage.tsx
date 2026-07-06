"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/sessionClient";
import { parseApiResponse } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ReferModal } from "@/components/ReferModal";
import type { SessionUser } from "@/lib/auth";

type Note = { id: string; patientName: string; content: string; letterName?: string | null; referred?: boolean };

type Props = { user: SessionUser };

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function GpNotesPage({ user }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("Untitled patient");
  const [content, setContent] = useState("");
  const [letterName, setLetterName] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"write" | "letter">("write");
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [referOpen, setReferOpen] = useState(false);
  const [message, setMessage] = useState("");
  const skipAutoSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef<Promise<Note | null> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const persistNote = useCallback(async () => {
    if (!content.trim() && !patientName.trim()) return null;

    if (saveInFlight.current) return saveInFlight.current;

    const run = async (): Promise<Note | null> => {
      setSaveStatus("saving");
      try {
        const payload = { patientName, content, letterName };
        if (noteId) {
          const res = await apiFetch(`/api/notes/${noteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await parseApiResponse<{ note?: Note; error?: string }>(res);
          if (!res.ok) throw new Error(data.error || "Save failed");
          if (!data.note) throw new Error("Save failed");
          setNotes((prev) => prev.map((n) => (n.id === noteId ? data.note! : n)));
          setSaveStatus("saved");
          return data.note;
        } else {
          const res = await apiFetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await parseApiResponse<{ note?: Note; error?: string }>(res);
          if (!res.ok) throw new Error(data.error || "Save failed");
          if (!data.note) throw new Error("Save failed");
          setNoteId(data.note.id);
          setNotes((prev) => [data.note!, ...prev.filter((n) => n.id !== data.note!.id)]);
          setSaveStatus("saved");
          return data.note;
        }
      } catch (e) {
        setSaveStatus("error");
        const msg = e instanceof Error ? e.message : "Auto-save failed";
        setMessage(msg);
        if (msg.includes("Unauthorized")) window.location.href = "/login";
        return null;
      }
    };

    saveInFlight.current = run();
    try {
      return await saveInFlight.current;
    } finally {
      saveInFlight.current = null;
    }
  }, [noteId, patientName, content, letterName]);

  useEffect(() => {
    apiFetch("/api/notes")
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return { notes: [] };
        }
        return parseApiResponse<{ notes?: Note[] }>(r);
      })
      .then((data) => setNotes(data.notes || []));
  }, []);

  // Auto-save after typing stops (1 second debounce)
  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    if (!content.trim()) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistNote();
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [content, patientName, letterName, persistNote]);

  function loadNote(note: Note) {
    skipAutoSave.current = true;
    setNoteId(note.id);
    setPatientName(note.patientName);
    setContent(note.content);
    setLetterName(note.letterName || null);
    setInputMode(note.letterName ? "letter" : "write");
    setMessage("");
    setSaveStatus("saved");
  }

  function newNote() {
    skipAutoSave.current = true;
    setNoteId(null);
    setPatientName("Untitled patient");
    setContent("");
    setLetterName(null);
    setInputMode("write");
    setMessage("");
    setSaveStatus("idle");
  }

  async function uploadLetterFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "pdf") {
      setMessage("Please upload a .txt or .pdf file");
      return;
    }

    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/upload-letter", { method: "POST", body: form, credentials: "include" });
      const data = await parseApiResponse<{ text?: string; fileName?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!data.text) throw new Error("Could not read file");
      skipAutoSave.current = false;
      setContent(data.text);
      setLetterName(data.fileName ?? null);
      setInputMode("letter");
      setMessage(`Loaded: ${data.fileName ?? file.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleLetterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLetterFile(file);
    e.target.value = "";
  }

  function handleLetterDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  }

  function handleLetterDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  async function handleLetterDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadLetterFile(file);
  }

  async function openRefer() {
    setMessage("");
    await persistNote();
    setReferOpen(true);
  }

  async function reloadNotes() {
    const r = await apiFetch("/api/notes");
    if (r.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await parseApiResponse<{ notes?: Note[] }>(r);
    setNotes(data.notes || []);
  }

  const saveLabel =
    saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "";

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} role="GP" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex flex-1 overflow-hidden">
          <section className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Patient notes</p>
            <p className="mb-3 text-xs text-slate-400">Drafts &amp; workspace — not sent referrals</p>
            <button
              type="button"
              onClick={newNote}
              className="mb-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              + New patient
            </button>
            <div className="space-y-1">
              {notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => loadNote(n)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    noteId === n.id ? "bg-white shadow-sm" : "hover:bg-white/70"
                  }`}
                >
                  <p className="truncate font-medium">
                    {n.patientName}
                    {n.referred && (
                      <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                        Referred
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {n.letterName ? `📎 ${n.letterName}` : n.content.slice(0, 40) || "Empty"}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-1 flex-col p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
                placeholder="Patient name"
              />

              <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setInputMode("write")}
                  className={`rounded-md px-3 py-1.5 ${inputMode === "write" ? "bg-sky-100 font-medium text-sky-800" : "text-slate-600"}`}
                >
                  Write note
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("letter")}
                  className={`rounded-md px-3 py-1.5 ${inputMode === "letter" ? "bg-sky-100 font-medium text-sky-800" : "text-slate-600"}`}
                >
                  Upload letter
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {saveLabel && (
                  <span className={`text-sm ${saveStatus === "error" ? "text-red-600" : "text-slate-500"}`}>
                    {saveLabel}
                  </span>
                )}
                {message && <span className="text-sm text-slate-500">{message}</span>}
                <button
                  type="button"
                  onClick={openRefer}
                  disabled={!content.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Refer
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              className="hidden"
              onChange={handleLetterUpload}
              disabled={uploading}
            />

            {inputMode === "letter" ? (
              <div
                onDragOver={handleLetterDragOver}
                onDragLeave={handleLetterDragLeave}
                onDrop={handleLetterDrop}
                className={`note-paper flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dashed transition-colors ${
                  isDragging
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-300 bg-white"
                }`}
              >
                {!content.trim() ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <p className="text-4xl text-slate-300" aria-hidden>
                      📄
                    </p>
                    <p className="text-base font-medium text-slate-700">
                      {uploading ? "Reading file…" : "Drag and drop your referral letter here"}
                    </p>
                    <p className="text-sm text-slate-500">Supports .txt and .pdf</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      Select from files
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {letterName && (
                      <div className="flex items-center justify-between border-b border-dashed border-slate-200 px-4 py-2 text-sm text-slate-600">
                        <span>📎 {letterName}</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="font-medium text-sky-700 hover:text-sky-900 disabled:opacity-50"
                        >
                          {uploading ? "Reading…" : "Replace letter"}
                        </button>
                      </div>
                    )}
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="min-h-0 flex-1 resize-none bg-transparent p-4 text-base outline-none"
                      placeholder="Letter text…"
                      spellCheck
                    />
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="note-paper min-h-0 flex-1 resize-none rounded-xl border border-dashed border-slate-300 p-4 text-base outline-none focus:border-sky-400"
                placeholder="Start writing patient notes…"
                spellCheck
              />
            )}
          </section>
        </main>
      </div>

      <ReferModal
        open={referOpen}
        onClose={() => setReferOpen(false)}
        noteId={noteId}
        content={content}
        patientName={patientName}
        onReferred={async (s) => {
          setMessage(`Referral sent to ${s.name}'s inbox`);
          await reloadNotes();
        }}
      />
    </div>
  );
}
