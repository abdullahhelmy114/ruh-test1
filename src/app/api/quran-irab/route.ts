import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { analyzeVerse } from "@/lib/irab-analyzer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const surah = parseInt(searchParams.get("surah") || "1");
  const ayah = parseInt(searchParams.get("ayah") || "1");

  if (isNaN(surah) || isNaN(ayah)) {
    return NextResponse.json({ error: "Invalid surah or ayah" }, { status: 400 });
  }

  try {
    const rawWords = await sql`
      SELECT arabic_text FROM quran_words
      WHERE surah_number = ${surah} AND ayah_number = ${ayah}
      ORDER BY word_position ASC
    `;

    if (!rawWords || rawWords.length === 0) {
      return NextResponse.json(
        { error: `Ayah not found: surah=${surah}, ayah=${ayah}. تأكد من استيراد البيانات` },
        { status: 404 }
      );
    }

    const words = rawWords.map((w: any) => ({ arabic_text: w.arabic_text as string }));
    const analysis = analyzeVerse(words);
    return NextResponse.json({ surah, ayah, words: analysis });
  } catch (error) {
    console.error("Irab error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}