import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);

async function importIrab() {
  console.log("📖 بدء استيراد إعراب القرآن من JSON...");
  const data = JSON.parse(readFileSync("data/quran_irab.json", "utf-8"));

  for (const ayah of data) {
    const [surah, ayahNum] = ayah.ayah.split(":").map(Number);
    for (let i = 0; i < ayah.words.length; i++) {
      const word = ayah.words[i];
      const components = word.irab.map(irab => ({
        text: irab.word,
        type: irab.type,
        position: irab.position,
        sign: irab.sign
      }));

      await sql`
        INSERT INTO surahpedia_irab (surah_number, ayah_number, word_position, word_text, components)
        VALUES (${surah}, ${ayahNum}, ${i + 1}, ${word.text}, ${JSON.stringify(components)})
        ON CONFLICT (surah_number, ayah_number, word_position) DO UPDATE
        SET components = ${JSON.stringify(components)}, word_text = ${word.text}
      `;
    }
    console.log(`✅ تم استيراد ${ayah.ayah}`);
  }
  console.log("🎉 اكتمل الاستيراد!");
  process.exit(0);
}

importIrab().catch(err => {
  console.error("❌ فشل الاستيراد:", err);
  process.exit(1);
});