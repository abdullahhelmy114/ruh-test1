// src/app/api/admin/curriculum/extract-text/route.ts
import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/pdf/extract-text";
import { firebaseAdmin } from "@/lib/firebase-admin";

async function verifyAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return result.length > 0 && result[0].role === "admin";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}