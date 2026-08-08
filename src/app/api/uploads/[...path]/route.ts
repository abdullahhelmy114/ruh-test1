// app/api/uploads/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // params.path عبارة عن مصفوفة من المقاطع، مثلاً ["cvs", "uid", "file.pdf"]
    const filePath = path.join(UPLOAD_ROOT, ...params.path);

    // منع الخروج من مجلد uploads (حماية من هجمات directory traversal)
    if (!filePath.startsWith(UPLOAD_ROOT)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // قراءة الملف
    const data = await readFile(filePath);

    // تحديد نوع المحتوى بناءً على الامتداد
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".mkv": "video/x-matroska",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400", // تخزين مؤقت لمدة يوم
      },
    });
  } catch (error) {
    return new NextResponse("Not Found", { status: 404 });
  }
}