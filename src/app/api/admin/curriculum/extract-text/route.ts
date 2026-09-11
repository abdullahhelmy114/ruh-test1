// src/app/api/admin/curriculum/extract-text/route.ts
import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/pdf/extract-text";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const POST = withApi(async (request) => {
  await requireAdmin(request);

  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No PDF files provided" }, { status: 400 });
    }

    const allTexts: string[] = [];
    for (const file of files) {
      if (file.type !== "application/pdf") continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractTextFromPdfBuffer(buffer);
      allTexts.push(`--- بداية ملف: ${file.name} ---\n${text}\n--- نهاية ملف: ${file.name} ---`);
    }

    const combinedText = allTexts.join("\n\n");
    if (combinedText.trim().length === 0) {
      return NextResponse.json({ error: "No text could be extracted from PDFs" }, { status: 400 });
    }

    return NextResponse.json({ text: combinedText });
  } catch (error: any) {
    console.error("Error extracting text:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract text" },
      { status: 500 }
    );
  }
});