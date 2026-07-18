// lib/quran-db.ts
import { sql } from "@/lib/db/client"; // اتصال Neon

interface WordAnalysis {
  word: string;
  meaning: string;
  irab: string; // النص الإعرابي الكامل
  sarf: string;
  root: string;
}

export async function getAyahIrab(surah: number, ayah: number) {
  const rows = await sql`
    SELECT r.word, r.rasm, m.meaning, i."irabMushakkal" as irab, s.sarf,
           ws.root, ws."repeatitionCount" as freq
    FROM word_content_rasm r
    LEFT JOIN word_content_meaning m ON m.surahNo=r.surahNo AND m.ayahNo=r.ayahNo AND m.wordNo=r.wordNo
    LEFT JOIN word_content_irab i ON i.surahNo=r.surahNo AND i.ayahNo=r.ayahNo AND i.wordNo=r.wordNo
    LEFT JOIN word_content_sarf s ON s.surahNo=r.surahNo AND s.ayahNo=r.ayahNo AND s.wordNo=r.wordNo
    LEFT JOIN word_statistics ws ON ws.surahNo=r.surahNo AND ws.ayahNo=r.ayahNo AND ws.wordNo=r.wordNo
    WHERE r.surahNo = ${surah} AND r.ayahNo = ${ayah}
    ORDER BY r.wordNo
  `;

  return rows as WordAnalysis[];
}

export async function getAyahTafsir(surah: number, ayah: number) {
  const [row] = await sql`
    SELECT tafsir FROM tafsir_saadi WHERE sura = ${surah} AND aya = ${ayah}
  `;
  return row?.tafsir || "";
}

export async function getAyahNozool(surah: number, ayah: number) {
  const [row] = await sql`
    SELECT "nozoolInfo" FROM ayah_content_nozool WHERE surahNo = ${surah} AND ayahNo = ${ayah}
  `;
  return row?.nozoolInfo || "";
}