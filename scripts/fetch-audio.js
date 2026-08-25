// scripts/fetch-audio.js
// جلب روابط الصوتيات وتحديث جدول words

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

// نفس دالة التوحيد
function normalizeArabicWord(word) {
  return word
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

// بناء رابط صوت الكلمة داخل الآية (كما في quran-api.ts)
function getWordAudioUrl(surah, ayah, wordPosition) {
  const s = String(surah).padStart(3, '0');
  const a = String(ayah).padStart(3, '0');
  const w = String(wordPosition).padStart(3, '0');
  return `https://audio.quranwbw.com/audio/${s}/${a}/${w}.mp3`;
}

// بناء رابط صوت الآية كاملة (للاستخدام المحتمل)
function getAyahAudioUrl(surah, ayah) {
  return `https://cdn.islamicnetwork.com/quran/audio/64/ar.alhudhaifi/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}

async function main() {
  console.log('Starting fetch-audio...');

  // 1. جلب الكلمات التي تحتاج تحديث (كل الكلمات)
  const words = await sql`
    SELECT id, word_ar, is_quranic
    FROM words
  `;
  console.log(`Found ${words.length} words.`);

  // 2. تحديث كل كلمة على دفعات
  const batchSize = 100;
  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    const updates = batch.map(async (word) => {
      let audioUrl = null;
      if (word.is_quranic) {
        // البحث عن أول موضع للكلمة في القرآن
        const normalized = normalizeArabicWord(word.word_ar);
        const occurrences = await sql`
          SELECT surah_number, ayah_number, word_position
          FROM quran_words
          WHERE normalized_text = ${normalized}
          ORDER BY surah_number, ayah_number, word_position
          LIMIT 1
        `;
        if (occurrences.length > 0) {
          const { surah_number, ayah_number, word_position } = occurrences[0];
          audioUrl = getWordAudioUrl(surah_number, ayah_number, word_position);
        }
      } else {
        // توليد صوت TTS (رابط مؤقت) أو اتركه null
        audioUrl = null;
      }

      if (audioUrl) {
        return sql`UPDATE words SET audio_url = ${audioUrl} WHERE id = ${word.id}`;
      }
      return null;
    });
    await Promise.all(updates.filter(Boolean));
    console.log(`Processed ${Math.min(i + batchSize, words.length)} / ${words.length}`);
  }

  console.log('Done! Audio URLs updated.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});