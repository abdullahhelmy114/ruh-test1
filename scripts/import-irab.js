// scripts/import-irab.js
// استيراد بيانات الإعراب من irab.json إلى Neon SQL

import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = neon(process.env.DATABASE_URL);
const INPUT_FILE = path.join(__dirname, '..', 'data', 'irab.json');

async function createTablesIfNotExists() {
  console.log('Creating tables if not exists...');

  await sql`
    CREATE TABLE IF NOT EXISTS quran_analysis (
      id SERIAL PRIMARY KEY,
      surah_number INT NOT NULL,
      ayah_numbers JSONB NOT NULL,
      irab TEXT,
      sarf TEXT,
      balagha TEXT,
      fawaid TEXT,
      part INT,
      page INT,
      ayah_text TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS quran_analysis_words (
      id SERIAL PRIMARY KEY,
      analysis_id INT REFERENCES quran_analysis(id) ON DELETE CASCADE,
      word TEXT,
      analysis TEXT,
      position INT
    )
  `;

  console.log('Tables ready.');
}

async function importData() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`File ${INPUT_FILE} not found.`);
    process.exit(1);
  }

  console.log(`Reading ${INPUT_FILE}...`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Found ${data.length} records.`);

  let inserted = 0;

  for (const record of data) {
    const {
      surah_number,
      ayah_numbers = [],
      irab,
      sarf,
      balagha,
      fawaid,
      part,
      page,
      ayah_text,
      irab_words = [],
    } = record;

    try {
      const result = await sql`
        INSERT INTO quran_analysis (
          surah_number,
          ayah_numbers,
          irab,
          sarf,
          balagha,
          fawaid,
          part,
          page,
          ayah_text
        )
        VALUES (
          ${surah_number},
          ${JSON.stringify(ayah_numbers)}::jsonb,
          ${irab || null},
          ${sarf || null},
          ${balagha || null},
          ${fawaid || null},
          ${part || null},
          ${page || null},
          ${ayah_text || null}
        )
        RETURNING id
      `;

      const analysisId = result[0].id;

      if (irab_words.length > 0) {
        for (let i = 0; i < irab_words.length; i++) {
          const w = irab_words[i];
          await sql`
            INSERT INTO quran_analysis_words (analysis_id, word, analysis, position)
            VALUES (${analysisId}, ${w.word}, ${w.analysis}, ${i + 1})
          `;
        }
      }

      inserted++;
      if (inserted % 100 === 0) {
        console.log(`Processed ${inserted} / ${data.length}`);
      }
    } catch (err) {
      console.error('Error inserting record:', record.surah_number, record.ayah_numbers, err.message);
    }
  }

  console.log(`✅ Import completed. Inserted ${inserted} records.`);
}

async function main() {
  await createTablesIfNotExists();
  await importData();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});