import { NextResponse } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await requireSessionFromRequest(req, ["GP", "SPECIALIST"]);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const name = file.name;
  const ext = name.split(".").pop()?.toLowerCase();

  if (ext === "txt") {
    const text = await file.text();
    return NextResponse.json({ text, fileName: name });
  }

  if (ext === "pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return NextResponse.json({ text: result.text || "", fileName: name });
    } catch {
      return NextResponse.json(
        { error: "Could not read PDF. Try a .txt file or paste the text manually." },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: "Unsupported file type. Upload .txt or .pdf" },
    { status: 400 }
  );
}
