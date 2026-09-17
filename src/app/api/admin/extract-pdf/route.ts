// app/api/admin/extract-pdf/route.ts
import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/pdf/extract-text";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(async (request) => {
  await requireAdmin(request);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractTextFromPdfBuffer(buffer);

    return NextResponse.json({ success: true, text: extractedText });
  } catch (error: any) {
    console.error("Error extracting PDF:", error);
    return NextResponse.json(
      { error: "Failed to extract text" },
      { status: 500 }
    );
  }
});