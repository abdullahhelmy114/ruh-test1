// src/app/api/quran-irab/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { analyzeVerse } from "@/lib/irab-analyzer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const surah = parseInt(searchParams.get("surah") || "1");
  const ayah = parseInt(searchParams.get("ayah") || "1");

  try {
    const rawWords = await sql`
      SELECT arabic_text FROM quran_words
      WHERE surah_number = ${surah} AND ayah_number = ${ayah}
      ORDER BY word_position ASC
    `;

    if (rawWords.length === 0) {
      return NextResponse.json({ error: "Ayah not found" }, { status: 404 });
    }

    // تحويل النتيجة إلى النوع المتوقع
    const words: { arabic_text: string }[] = rawWords.map((w: any) => ({
      arabic_text: w.arabic_text as string,
    }));

    const analysis = analyzeVerse(words);
    return NextResponse.json({ surah, ayah, words: analysis });
  } catch (error) {
    console.error("Irab error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}