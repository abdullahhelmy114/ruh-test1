import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bookTitle = formData.get("book_title") as string;

    if (!file || !bookTitle) return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);

    try {
      // حفظ الملف مؤقتاً
      fs.writeFileSync(tempFilePath, buffer);

      // رفع الملف مباشرة إلى Gemini
      const uploadResponse = await fileManager.uploadFile(tempFilePath, {
        mimeType: "application/pdf",
        displayName: bookTitle,
      });

      const fileUri = uploadResponse.file.uri;

      // حفظ الرابط في قاعدة البيانات
      await sql`
        INSERT INTO gemini_books (title, file_uri)
        VALUES (${bookTitle}, ${fileUri})
      `;

      return NextResponse.json({ success: true, message: "تم رفع الكتاب إلى عقل Gemini بنجاح!" });
    } finally {
      // حذف الملف المؤقت في كل الحالات (نجاح أو فشل)
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error: any) {
    console.error("Gemini Upload Error:", error);
    return NextResponse.json({ error: "فشل الرفع لسيرفرات جوجل" }, { status: 500 });
  }
}