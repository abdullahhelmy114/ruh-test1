// app/api/uploads/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { resolveWithinRoot, servePolicyFor } from "@/lib/security/upload-policy";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// Phase 3 batch 2 — file-serving boundary.
// The requested segments are resolved against the upload root with a
// separator-aware containment check (no traversal, no sibling-prefix
// bypass). Only allowlisted extensions are served, each with a fixed
// content type, `X-Content-Type-Options: nosniff`, and `Content-Disposition:
// attachment` unless the type is safe to render inline (images, PDF,
// MP4/MOV). HTML, SVG and script types are never served. Errors never
// expose filesystem paths. Response codes (403/404) are unchanged.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }   // ← Next.js 16: params أصبح Promise
) {
  try {
    const { path: pathSegments } = await params; // ← انتظار الـ Promise

    // منع الخروج من مجلد uploads
    const filePath = resolveWithinRoot(UPLOAD_ROOT, pathSegments ?? []);
    if (!filePath) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const policy = servePolicyFor(filePath);
    if (!policy) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const data = await readFile(filePath);

    return new NextResponse(data, {
      headers: {
        "Content-Type": policy.contentType,
        "Content-Disposition": `${policy.disposition}; filename="${path.basename(filePath)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return new NextResponse("Not Found", { status: 404 });
  }
}
