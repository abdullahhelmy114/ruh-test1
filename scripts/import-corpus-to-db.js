// scripts/import-corpus-to-db.js
import fs from 'fs';
import readline from 'readline';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const INPUT_FILE = 'data/quranic-corpus-morphology.txt';

// ==========================================
// 🚀 إعدادات الاستئناف (Resume Settings)
// ==========================================
const START_SURAH = 47; // يبدأ من سورة محمد
const START_AYAH = 11;  // يبدأ من الآية 11
// ==========================================

const wordsCache = new Map();

function getWordKey(surah, ayah, wordNum) {
  return `${surah}:${ayah}:${wordNum}`;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(operation, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`\n⏳ انقطع الاتصال... إعادة المحاولة (${attempt}/${maxRetries})`);
      await sleep(3000 * attempt);
    }
  }
}

// ==========================================
// 🔠 محول شفرة الفرانكو (Buckwalter) إلى عربي
// ==========================================
const buckwalterToArabic = {
  "'": "ء", "|": "آ", "?": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
  "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
  "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
  "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
  "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
  "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "^": "ط", "#": "ص"
};

function toArabic(bwText) {
  return bwText.split('').map(char => buckwalterToArabic[char] || char).join('');
}
// ==========================================

async function processLine(line) {
  if (!line.startsWith('(')) return;
  const parts = line.split('\t');
  if (parts.length < 4) return;

  const locMatch = parts[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
  if (!locMatch) return;

  const surah = parseInt(locMatch[1]);
  const ayah = parseInt(locMatch[2]);
  
  // ⛔ تخطي كل السور والآيات التي تم حفظها مسبقاً
  if (surah < START_SURAH) return;
  if (surah === START_SURAH && ayah < START_AYAH) return;

  const wordNum = parseInt(locMatch[3]);
  const segmentNum = parseInt(locMatch[4]);
  
  // تحويل الفرانكو إلى عربي فوراً
  const form = toArabic(parts[1]); 
  
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
  const [wordRow] = await sql`
    INSERT INTO quran_corpus_words (surah_number, ayah_number, word_position, word_text)
    VALUES (${entry.surah}, ${entry.ayah}, ${entry.wordNum}, ${entry.wordText})
    ON CONFLICT (surah_number, ayah_number, word_position) DO UPDATE SET word_text = ${entry.wordText}
    RETURNING id
  `;
  const wordId = wordRow.id;

  for (const seg of entry.segments) {
    await sql`
      INSERT INTO quran_corpus_segments (word_id, segment_number, segment_text, tag, features)
      VALUES (${wordId}, ${seg.segmentNum}, ${seg.form}, ${seg.tag}, ${seg.features})
      ON CONFLICT (word_id, segment_number) DO UPDATE SET segment_text = ${seg.form}, tag = ${seg.tag}, features = ${seg.features}
    `;
  }
}

async function main() {
  console.log(`📖 استئناف الاستيراد من السورة ${START_SURAH} الآية ${START_AYAH}...`);
  console.log(`🔠 تم تفعيل مترجم اللغات (Buckwalter to Arabic)...`);

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
      
      // لا نفعل شيء إذا كنا لا نزال في النطاق المتخَطَّى
      if (surah < START_SURAH || (surah === START_SURAH && ayah < START_AYAH)) continue;

      const key = getWordKey(surah, ayah, wordNum);
      
      if (currentKey && key !== currentKey) {
        const prevEntry = wordsCache.get(currentKey);
        if (prevEntry) {
          await withRetry(() => flushWord(prevEntry));
          wordsCache.delete(currentKey);
          wordCount++;
          
          if (wordCount % 500 === 0) {
            console.log(`   ✅ تم رفع ${wordCount} كلمة بالعربي... (نحن الآن في سورة ${surah} آية ${ayah})`);
          }
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

  console.log(`🎉 اكتمل الاستيراد بنجاح حتى سورة الناس!`);
  console.log(`   📝 الكلمات التي تم رفعها في هذه الجلسة: ${wordCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ فشل السكربت:', err);
  process.exit(1);
});