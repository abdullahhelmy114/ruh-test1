// scripts/build-quran-index.js
// تجهيز جدول quran_words بإضافة عمود normalized_text وملئه

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

// نفس دالة التوحيد المستخدمة في التطبيق
function normalizeArabicWord(word) {
  return word
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

async function columnExists(table, column) {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `;
  return result.length > 0;
}

async function main() {
  console.log('Starting build-quran-index...');

  // 1. التحقق من وجود العمود normalized_text وإضافته إذا لزم
  const exists = await columnExists('quran_words', 'normalized_text');
  if (!exists) {
    console.log('Adding column normalized_text to quran_words...');
    await sql`ALTER TABLE quran_words ADD COLUMN normalized_text TEXT`;
  } else {
    console.log('Column normalized_text already exists.');
  }

  // 2. جلب كل الصفوف التي تحتاج تحديث
  console.log('Fetching rows...');
  const rows = await sql`
    SELECT id, arabic_text
    FROM quran_words
  `;
  console.log(`Found ${rows.length} rows.`);

  // 3. تحديث كل صف على دفعات (200 صف في كل دفعة)
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const updates = batch.map(row => {
      const normalized = normalizeArabicWord(row.arabic_text);
      return sql`UPDATE quran_words SET normalized_text = ${normalized} WHERE id = ${row.id}`;
    });
    await Promise.all(updates);
    console.log(`Processed ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  // 4. إنشاء فهرس على العمود لتسريع البحث
  console.log('Creating index on normalized_text...');
  await sql`CREATE INDEX IF NOT EXISTS idx_quran_words_normalized_text ON quran_words (normalized_text)`;

  console.log('Done! Quran word index built successfully.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});