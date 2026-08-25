// src/app/api/irab/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const surah = searchParams.get("surah")?.trim();
  const ayah = searchParams.get("ayah")?.trim();
  const word = searchParams.get("word")?.trim() || null;

  if (!word && (!surah || isNaN(Number(surah)))) {
    return NextResponse.json(
      { error: "Invalid or missing surah number" },
      { status: 400 }
    );
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    let analyses: any[];

    if (word) {
      // البحث عن التحليلات التي تحتوي على الكلمة في جدول الكلمات
      const wordRows = await sql`
        SELECT DISTINCT analysis_id
        FROM quran_analysis_words
        WHERE word = ${word}
      `;
      const analysisIds = wordRows.map((r: any) => r.analysis_id);
      if (analysisIds.length === 0) {
        return NextResponse.json({ analyses: [] });
      }
      analyses = await sql`
        SELECT id, surah_number, ayah_numbers, irab, sarf, balagha, fawaid, part, page, ayah_text
        FROM quran_analysis
        WHERE id = ANY(${analysisIds})
        ORDER BY id ASC
      `;
    } else if (surah) {
      const surahNumber = Number(surah);
      const ayahNumber = ayah ? Number(ayah) : null;
      if (ayahNumber) {
        analyses = await sql`
          SELECT id, surah_number, ayah_numbers, irab, sarf, balagha, fawaid, part, page, ayah_text
          FROM quran_analysis
          WHERE surah_number = ${surahNumber}
            AND ayah_numbers @> ${JSON.stringify([ayahNumber])}::jsonb
          ORDER BY id ASC
        `;
      } else {
        analyses = await sql`
          SELECT id, surah_number, ayah_numbers, irab, sarf, balagha, fawaid, part, page, ayah_text
          FROM quran_analysis
          WHERE surah_number = ${surahNumber}
          ORDER BY id ASC
        `;
      }
    } else {
      return NextResponse.json({ analyses: [] });
    }

    if (analyses.length === 0) {
      return NextResponse.json({ analyses: [] });
    }

    const ids = analyses.map((a: any) => a.id);
    const words = await sql`
      SELECT analysis_id, word, analysis, position
      FROM quran_analysis_words
      WHERE analysis_id = ANY(${ids})
      ORDER BY analysis_id, position ASC
    `;

    const wordsByAnalysis: Record<number, any[]> = {};
    for (const w of words) {
      if (!wordsByAnalysis[w.analysis_id]) {
        wordsByAnalysis[w.analysis_id] = [];
      }
      wordsByAnalysis[w.analysis_id].push({
        word: w.word,
        analysis: w.analysis,
        position: w.position,
      });
    }

    const result = analyses.map((a: any) => ({
      ...a,
      irab_words: wordsByAnalysis[a.id] || [],
    }));

    return NextResponse.json({ analyses: result });
  } catch (error: any) {
    console.error("Error fetching irab:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch irab" },
      { status: 500 }
    );
  }
}