import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { serverTempFilePath } from "@/lib/security/upload-policy";
import { boundedString } from "@/lib/security/input-policy";

export const dynamic = "force-dynamic";

// Phase 3 closure fix F1 — admin knowledge (PDF -> Gemini) upload.
// Previously the temporary file was written to
//   path.join(os.tmpdir(), `${Date.now()}-${file.name}`)
// and Node's multipart parser preserves `../` segments in a filename, so an
// admin request could overwrite (and then unlink) any writable file on the
// host. Now:
//   - the temp path is fully server-generated: os.tmpdir() + randomUUID() + ".pdf",
//     proven to sit directly inside the temp directory; the client filename
//     is never used for any filesystem operation
//   - PDF only: the admin UI accepts .pdf and the provider call has always
//     declared application/pdf, so the declared type must be application/pdf
//     and the bytes must start with the PDF signature
//   - size capped at MAX_PDF_BYTES (50 MB) BEFORE the body is read; the
//     route still materialises the file in memory (arrayBuffer), which is
//     acceptable for an admin-only route at this cap
//   - cleanup in `finally` only ever targets the generated path
//   - generic errors; no provider body, temp path or file content is logged
//     or returned
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const TITLE_MAX = 200;
const PDF_MIME = "application/pdf";
const PDF_SIGNATURE = Buffer.from("%PDF-");

export const POST = withApi(async (req) => {
  await requireAdmin(req);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Knowledge upload unavailable" }, { status: 503 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });

  const file = formData.get("file");
  const bookTitle = boundedString(formData.get("book_title"), { max: TITLE_MAX });

  if (!(file instanceof File) || !bookTitle) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }
  const declaredType = file.type.toLowerCase().split(";")[0].trim();
  if (declaredType !== PDF_MIME) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_PDF_BYTES || !buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
  }

  // Server-generated temp path: the client filename plays no part.
  const tempFilePath = serverTempFilePath(os.tmpdir(), randomUUID(), ".pdf");

  try {
    // حفظ الملف مؤقتاً (wx: never overwrite an existing path)
    fs.writeFileSync(tempFilePath, buffer, { flag: "wx" });

    // رفع الملف مباشرة إلى Gemini
    const fileManager = new GoogleAIFileManager(apiKey);
    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType: PDF_MIME,
      displayName: bookTitle,
    });

    const fileUri = uploadResponse.file.uri;

    // حفظ الرابط في قاعدة البيانات
    await sql`
      INSERT INTO gemini_books (title, file_uri)
      VALUES (${bookTitle}, ${fileUri})
    `;

    return NextResponse.json({ success: true, message: "تم رفع الكتاب إلى عقل Gemini بنجاح!" });
  } catch (error) {
    console.error("upload-gemini failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "فشل الرفع لسيرفرات جوجل" }, { status: 502 });
  } finally {
    // حذف الملف المؤقت في كل الحالات (نجاح أو فشل) — المسار المولّد فقط
    fs.rmSync(tempFilePath, { force: true });
  }
});
