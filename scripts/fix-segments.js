import fs from 'fs';
import readline from 'readline';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

// بناء مسار ديناميكي دقيق 100%
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// يرجع خطوة للخلف من مجلد scripts ثم يدخل إلى مجلد data
const INPUT_FILE = path.join(__dirname, '../data/quranic-corpus-morphology.txt');

const sql = neon(process.env.DATABASE_URL);
const buckwalterToArabic = {
  "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
  "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
  "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
  "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
  "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
  "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "^": "", "@": "۟",
  "\"": "۠", "[": "ۜ", "_": "ٖ", "+": "ۥ", "%": "ۦ", "#": "۩"
};

function toArabic(bwText) {
  return bwText.split('').map(char => buckwalterToArabic[char] || char).join('');
}

const wordsCache = new Map();

function getWordKey(surah, ayah, wordNum) { return `${surah}:${ayah}:${wordNum}`; }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(operation, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await operation(); } 
    catch (error) { if (attempt === maxRetries) throw error; await sleep(2000 * attempt); }
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
  
  // ⛔ التوقف عند سورة 47 لأنها سليمة ولا تحتاج إصلاح
  if (surah > 46) return;

  const wordNum = parseInt(locMatch[3]);
  const segmentNum = parseInt(locMatch[4]);
  
  const form = toArabic(parts[1]); 
  const key = getWordKey(surah, ayah, wordNum);
  
  if (!wordsCache.has(key)) wordsCache.set(key, { surah, ayah, wordNum, segments: [] });
  wordsCache.get(key).segments.push({ segmentNum, form });
}

async function flushWord(entry) {
  const [wordRow] = await sql`
    SELECT id FROM quran_corpus_words 
    WHERE surah_number = ${entry.surah} AND ayah_number = ${entry.ayah} AND word_position = ${entry.wordNum}
  `;
  if (!wordRow) return;
  
  // تحديث المقاطع فقط باللغة العربية السليمة دون المساس بالكلمة الرئيسية
  for (const seg of entry.segments) {
    await sql`UPDATE quran_corpus_segments SET segment_text = ${seg.form} WHERE word_id = ${wordRow.id} AND segment_number = ${seg.segmentNum}`;
  }
}

async function main() {
  console.log('🛠️ جاري إصلاح الأحرف المفقودة في أول 46 سورة...');
  const rl = readline.createInterface({ input: fs.createReadStream(INPUT_FILE), crlfDelay: Infinity });

  let wordCount = 0;
  let currentKey = '';

  for await (const line of rl) {
    const locMatch = line.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (!locMatch) continue;
    const surah = parseInt(locMatch[1]);
    if (surah > 46) break;

    processLine(line);
    const key = getWordKey(surah, parseInt(locMatch[2]), parseInt(locMatch[3]));
    
    if (currentKey && key !== currentKey) {
      const prevEntry = wordsCache.get(currentKey);
      if (prevEntry) {
        await withRetry(() => flushWord(prevEntry));
        wordsCache.delete(currentKey);
        wordCount++;
        if (wordCount % 1000 === 0) console.log(`   ✅ تم إصلاح ${wordCount} كلمة... (نحن في سورة ${surah})`);
        await sleep(5);
      }
    }
    currentKey = key;
  }
  
  if (currentKey && wordsCache.has(currentKey)) { await withRetry(() => flushWord(wordsCache.get(currentKey))); }
  console.log(`🎉 اكتمل الإصلاح بنجاح!`);
  process.exit(0);
}

main().catch(console.error);