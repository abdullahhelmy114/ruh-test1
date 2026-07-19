// scripts/import-corpus-to-db.js
import fs from 'fs';
import readline from 'readline';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);
const INPUT_FILE = 'data/quranic-corpus-morphology.txt';

const wordsCache = new Map();

function getWordKey(surah, ayah, wordNum) {
  return `${surah}:${ayah}:${wordNum}`;
}

// دالة لإيقاف السكربت مؤقتاً (لإراحة السيرفر)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// دالة لتنفيذ الاستعلام مع إعادة المحاولة عند انقطاع الاتصال
async function withRetry(operation, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`\n⏳ انقطع الاتصال بـ Neon (محاولة ${attempt}/${maxRetries})... إعادة المحاولة بعد ${attempt * 3} ثوانٍ`);
      await sleep(3000 * attempt); // الانتظار وقتاً أطول مع كل محاولة فاشلة
    }
  }
}

async function processLine(line) {
  if (!line.startsWith('(')) return;
  const parts = line.split('\t');
  if (parts.length < 4) return;

  const locMatch = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
  if (!locMatch) return;

  const surah = parseInt(locMatch[1]);
  const ayah = parseInt(locMatch[2]);
  const wordNum = parseInt(locMatch[3]);
  const segmentNum = parseInt(locMatch[4]);
  const form = parts[1].replace(/[{<~}]/g, '');
  const tag = parts[2];
  const features = parts[3].trim();

  const key = getWordKey(surah, ayah, wordNum);
  if (!wordsCache.has(key)) {
    wordsCache.set(key, {
      surah, ayah, wordNum,
      segments: [],
      wordText: segmentNum === 1 ? form : ''
    });
  }
  const entry = wordsCache.get(key);
  if (segmentNum === 1) {
    entry.wordText = form;
  }
  entry.segments.push({ segmentNum, form, tag, features });
}

async function flushWord(entry) {
  // إدراج الكلمة
  const [wordRow] = await sql`
    INSERT INTO quran_corpus_words (surah_number, ayah_number, word_position, word_text)
    VALUES (${entry.surah}, ${entry.ayah}, ${entry.wordNum}, ${entry.wordText})
    ON CONFLICT (surah_number, ayah_number, word_position) DO UPDATE SET word_text = ${entry.wordText}
    RETURNING id
  `;
  const wordId = wordRow.id;

  // إدراج مقاطع الكلمة
  for (const seg of entry.segments) {
    await sql`
      INSERT INTO quran_corpus_segments (word_id, segment_number, segment_text, tag, features)
      VALUES (${wordId}, ${seg.segmentNum}, ${seg.form}, ${seg.tag}, ${seg.features})
      ON CONFLICT (word_id, segment_number) DO UPDATE SET segment_text = ${seg.form}, tag = ${seg.tag}, features = ${seg.features}
    `;
  }
}

async function main() {
  console.log('📖 بدء/استئناف استيراد بيانات QAC إلى قاعدة البيانات...');
  
  // ⚠️ تم إيقاف كود مسح البيانات (DELETE) لكي يستأنف السكربت عمله دون أن يبدأ من الصفر

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE),
    crlfDelay: Infinity
  });

  let count = 0;
  let wordCount = 0;
  let currentKey = '';

  for await (const line of rl) {
    processLine(line);

    const locMatch = line.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (locMatch) {
      const [surah, ayah, wordNum] = [parseInt(locMatch[1]), parseInt(locMatch[2]), parseInt(locMatch[3])];
      const key = getWordKey(surah, ayah, wordNum);
      
      if (currentKey && key !== currentKey) {
        const prevEntry = wordsCache.get(currentKey);
        if (prevEntry) {
          // تنفيذ الإدخال مع نظام إعادة المحاولة
          await withRetry(() => flushWord(prevEntry));
          wordsCache.delete(currentKey);
          wordCount++;
          
          if (wordCount % 1000 === 0) {
            console.log(`   ✅ تمت معالجة وحفظ ${wordCount} كلمة...`);
          }
          
          // استراحة 5 أجزاء من الثانية بعد كل كلمة لتخفيف الضغط على السيرفر
          await sleep(5);
        }
      }
      currentKey = key;
    }

    count++;
  }

  if (currentKey && wordsCache.has(currentKey)) {
    await withRetry(() => flushWord(wordsCache.get(currentKey)));
    wordCount++;
  }

  console.log(`🎉 اكتمل الاستيراد!`);
  console.log(`   📝 الكلمات المخزنة: ${wordCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ فشل السكربت بالكامل:', err);
  process.exit(1);
});