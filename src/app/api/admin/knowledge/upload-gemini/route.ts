import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
// المكتبة الرسمية من جوجل لرفع الملفات
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bookTitle = formData.get("book_title") as string;

    if (!file || !bookTitle) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    // 1. حفظ الملف مؤقتاً في السيرفر لكي نرسله لجوجل
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);
    fs.writeFileSync(tempFilePath, buffer);

    // 2. رفع الملف مباشرة إلى سيرفرات Gemini! (كما يفعل Google Studio)
    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType: "application/pdf",
      displayName: bookTitle,
    });

    // 3. مسح الملف المؤقت من سيرفرك لتوفير المساحة
    fs.unlinkSync(tempFilePath);

    // 4. حفظ "معرف الملف السحابي" في قاعدة بياناتك
    const fileUri = uploadResponse.file.uri;
    await sql`
      INSERT INTO gemini_books (title, file_uri)
      VALUES (${bookTitle}, ${fileUri})
    `;

    return NextResponse.json({ success: true, message: "تم رفع الكتاب إلى عقل Gemini بنجاح!" });

  } catch (error: any) {
    console.error("Gemini Upload Error:", error);
    return NextResponse.json({ error: "فشل الرفع لسيرفرات جوجل" }, { status: 500 });
  }
}