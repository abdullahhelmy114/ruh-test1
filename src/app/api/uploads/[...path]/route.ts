// app/api/uploads/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }   // ← Next.js 16: params أصبح Promise
) {
  try {
    const { path: pathSegments } = await params; // ← انتظار الـ Promise

    const filePath = path.join(UPLOAD_ROOT, ...pathSegments);

    // منع الخروج من مجلد uploads
    if (!filePath.startsWith(UPLOAD_ROOT)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const data = await readFile(filePath);

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
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}