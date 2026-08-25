// scripts/seed-database.js
// إنشاء جدول words واستيراد الكلمات من data/wiktionary-words.json مع حفظ التقدم

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = neon(process.env.DATABASE_URL);
const JSON_FILE = path.join(__dirname, '..', 'data', 'wiktionary-words.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'data', 'seed-progress.json');

async function createTableIfNotExists() {
  console.log('Ensuring words table exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      word_ar TEXT NOT NULL UNIQUE,
      plural_ar TEXT,
      antonym_ar TEXT,
      meaning_en TEXT,
      meaning_tr TEXT,
      is_quranic BOOLEAN DEFAULT FALSE,
      audio_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('words table ready.');
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return 0;
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    return Number(data.offset) || 0;
  } catch {
    return 0;
  }
}

function saveProgress(offset) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ offset }), 'utf8');
}

async function importWords(startOffset = 0) {
  if (!fs.existsSync(JSON_FILE)) {
    console.log(`File ${JSON_FILE} not found. Skipping import.`);
    return;
  }

  console.log(`Reading ${JSON_FILE}...`);
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const words = JSON.parse(raw);

  if (!Array.isArray(words) || words.length === 0) {
    console.log('No words to import.');
    return;
  }

  if (startOffset >= words.length) {
    console.log('Already processed all words.');
    return;
  }

  console.log(`Resuming from offset ${startOffset} / ${words.length} words.`);
  const batchSize = 200;

  for (let i = startOffset; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    const values = batch.filter(w => w.word_ar).map(w => ({
      word_ar: w.word_ar,
      plural_ar: w.plural_ar || null,
      antonym_ar: w.antonym_ar || null,
      meaning_en: w.meaning_en || null,
      meaning_tr: w.meaning_tr || null,
      is_quranic: false,
    }));

    if (values.length === 0) {
      saveProgress(i + batchSize);
      continue;
    }

    for (const word of values) {
      await sql`
        INSERT INTO words (word_ar, plural_ar, antonym_ar, meaning_en, meaning_tr, is_quranic)
        VALUES (${word.word_ar}, ${word.plural_ar}, ${word.antonym_ar}, ${word.meaning_en}, ${word.meaning_tr}, ${word.is_quranic})
        ON CONFLICT (word_ar) DO NOTHING
      `;
    }

    // حفظ التقدم بعد كل دفعة
    const nextOffset = Math.min(i + batchSize, words.length);
    saveProgress(nextOffset);
    console.log(`Processed ${nextOffset} / ${words.length}`);
  }

  console.log('Import completed.');
}

async function updateQuranicFlag() {
  console.log('Updating is_quranic flag based on quran_words...');
  try {
    const result = await sql`
      UPDATE words w
      SET is_quranic = TRUE
      FROM quran_words qw
      WHERE qw.normalized_text = w.word_ar
    `;
    console.log(`Updated ${result.count} rows.`);
  } catch (err) {
    console.warn('Could not update is_quranic flag. Ensure quran_words table exists and is normalized.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--reset')) {
    console.log('Resetting progress...');
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  }

  const startOffset = loadProgress();

  await createTableIfNotExists();
  await importWords(startOffset);
  await updateQuranicFlag();

  console.log('Seed completed.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});