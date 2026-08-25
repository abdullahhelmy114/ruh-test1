// src/app/api/word/[id]/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// توحيد الكلمة للبحث (إزالة التشكيل وتوحيد الأحرف)
function normalizeArabicWord(word: string): string {
  return word
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .trim();
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const wordId = Number(params.id);
  if (isNaN(wordId)) {
    return NextResponse.json({ error: "Invalid word id" }, { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // 1. جلب الكلمة من جدول words
    const wordRows = await sql`
      SELECT id, word_ar, plural_ar, antonym_ar, meaning_en, meaning_tr, is_quranic, audio_url, created_at
      FROM words
      WHERE id = ${wordId}
      LIMIT 1
    `;

    if (wordRows.length === 0) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    const word = wordRows[0];

    // 2. توحيد الكلمة
    const normalizedWord = normalizeArabicWord(word.word_ar);

    // 3. جلب مواضع الكلمة من جدول quran_words
    // نستخدم عمود normalized_text (سيتم إضافته في السكربتات)
    const occurrences = await sql`
      SELECT surah_number, ayah_number, word_position, arabic_text
      FROM quran_words
      WHERE normalized_text = ${normalizedWord}
      ORDER BY surah_number, ayah_number, word_position
    `;

    // 4. استخراج أزواج (سورة، آية) فريدة
    const uniqueAyahs = Array.from(
      new Map(
        occurrences.map((occ: any) => [
          `${occ.surah_number}:${occ.ayah_number}`,
          { surah_number: occ.surah_number, ayah_number: occ.ayah_number },
        ])
      ).values()
    );

    // 5. بناء نص الآية لكل آية فريدة
    const verses = [];
    for (const ayah of uniqueAyahs) {
      // جلب كل كلمات الآية مرتبة
      const ayahWords = await sql`
        SELECT word_position, arabic_text
        FROM quran_words
        WHERE surah_number = ${ayah.surah_number} AND ayah_number = ${ayah.ayah_number}
        ORDER BY word_position
      `;
      const text_ar = ayahWords.map((w: any) => w.arabic_text).join(" ");
      // تحديد موضع الكلمة المستهدفة في هذه الآية (نأخذ أول ظهور)
      const firstOccurrence = occurrences.find(
        (occ: any) =>
          occ.surah_number === ayah.surah_number &&
          occ.ayah_number === ayah.ayah_number
      );
      verses.push({
        surah_number: ayah.surah_number,
        ayah_number: ayah.ayah_number,
        text_ar,
        word_position: firstOccurrence?.word_position,
      });
    }

    return NextResponse.json({ word, verses });
  } catch (error: any) {
    console.error("Error fetching word details:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch word details" },
      { status: 500 }
    );
  }
}