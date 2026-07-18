// lib/quran-db.ts
import { sql } from "@/lib/db/client";

export async function getAyahIrab(surah: number, ayah: number) {
  const rows = await sql`
    SELECT word_text, components FROM surahpedia_irab
    WHERE surah_number = ${surah} AND ayah_number = ${ayah}
    ORDER BY word_position
  `;

  return rows.map((w: any) => ({
    word: w.word_text,
    components: typeof w.components === "string"
      ? JSON.parse(w.components)
      : w.components
  }));
}