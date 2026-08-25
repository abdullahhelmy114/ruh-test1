// scripts/import-contemporary-db.js
// استيراد بيانات معجم اللغة العربية المعاصرة من JSON إلى Neon SQL

import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = neon(process.env.DATABASE_URL);
const INPUT_FILE = path.join(__dirname, '..', 'data', 'mo3jam-contemporary.json');

async function createTableIfNotExists() {
  console.log('Ensuring dictionary_entries table exists...');
  await sql`
    CREATE TABLE IF NOT EXISTS dictionary_entries (
      id SERIAL PRIMARY KEY,
      entry_number INT NOT NULL,
      root TEXT NOT NULL,
      word TEXT NOT NULL,
      word_type TEXT,
      meanings JSONB NOT NULL DEFAULT '[]',
      part INT,
      page INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(entry_number, root, word)
    )
  `;
  console.log('Table ready.');
}

async function importEntries() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`File ${INPUT_FILE} not found.`);
    process.exit(1);
  }

  console.log(`Reading ${INPUT_FILE}...`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Found ${data.length} entries.`);

  let inserted = 0;
  let skipped = 0;

  for (const entry of data) {
    try {
      await sql`
        INSERT INTO dictionary_entries (entry_number, root, word, word_type, meanings, part, page)
        VALUES (
          ${entry.entry_number},
          ${entry.root},
          ${entry.word},
          ${entry.word_type || null},
          ${JSON.stringify(entry.meanings || [])}::jsonb,
          ${entry.part || null},
          ${entry.page || null}
        )
        ON CONFLICT (entry_number, root, word) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      skipped++;
      if (skipped <= 5) {
        console.warn('Error inserting entry:', entry, err.message);
      }
    }
  }

  console.log(`✅ Import completed. Inserted: ${inserted}, Skipped: ${skipped}`);
}

async function main() {
  await createTableIfNotExists();
  await importEntries();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});