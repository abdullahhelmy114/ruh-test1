// scripts/import-quran.js
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);

// قائمة برموز الوقف والترقيم التي يجب تجاهلها
const STOP_MARKS = new Set(["ۛ", "ۖ", "ۗ", "ۘ", "ۙ", "ۚ", "ۭ", "ۜ", "ۣ", "ۨ", "۩", "۟", "۠", "ۡ", "ۢ", "ۤ", "ۥ", "ۦ", "ۧ", "ۨ", "۩", "۪", "۫", "۬", "ۭ", "﴿", "﴾"]);

function isStopMark(text) {
  return STOP_MARKS.has(text.trim()) || /^[ۭۛۖۗۘۙۚ]+$/.test(text.trim());
}

async function importQuran(filePath) {
  console.log("📖 بدء استيراد كلمات القرآن...");

  // حذف البيانات القديمة (اختياري)
  await sql`DELETE FROM quran_words`;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim() !== "");
  
  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 4) continue;

    const surah = parseInt(parts[0], 10);
    const ayah = parseInt(parts[1], 10);
    const position = parseInt(parts[2], 10);
    const text = parts[3].trim();

    if (isStopMark(text) || text.length === 0) {
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO quran_words (surah_number, ayah_number, word_position, arabic_text)
      VALUES (${surah}, ${ayah}, ${position}, ${text})
    `;

    imported++;
    if (imported % 500 === 0) {
      console.log(`   ✅ تم استيراد ${imported} كلمة حتى الآن...`);
    }
  }

  console.log(`\n🎉 اكتمل الاستيراد!`);
  console.log(`   📥 الكلمات المستوردة: ${imported}`);
  console.log(`   🗑️ علامات الترقيم المتجاهلة: ${skipped}`);
  process.exit(0);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("❌ يرجى تحديد مسار ملف الكلمات");
  process.exit(1);
}

importQuran(filePath).catch(err => {
  console.error("❌ فشل الاستيراد:", err);
  process.exit(1);
});