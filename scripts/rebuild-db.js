import fs from 'fs';
import readline from 'readline';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INPUT_FILE = path.join(__dirname, '../data/quranic-corpus-morphology.txt');

const sql = neon(process.env.DATABASE_URL);

// 🔠 قاموس الترجمة الشامل (يحتوي على الألف والشدة والهمزات)
const buckwalterToArabic = {
  "'": "ء", "|": "آ", "?": "أ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
  "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج",
  "H": "ح", "x": "خ", "d": "د", "*": "ذ", "r": "ر", "z": "ز",
  "s": "س", "$": "ش", "S": "ص", "D": "ض", "T": "ط", "Z": "ظ",
  "E": "ع", "g": "غ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
  "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى", "y": "ي",
  "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
  "~": "ّ", "o": "ْ", "`": "ٰ", "{": "ٱ", "^": "ٰ", "@": "۟",
  "\"": "۠", "[": "ۜ", "_": "ٖ", "+": "ۥ", "%": "ۦ", "#": "۩",
  "I": "إ", "O": "أ", "W": "ؤ"
};

function toArabic(bwText) {
  if (!bwText) return "";
  return bwText.split('').map(char => buckwalterToArabic[char] || char).join('');
}

const wordsCache = new Map();
function getWordKey(surah, ayah, wordNum) { return `${surah}:${ayah}:${wordNum}`; }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(operation, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await operation(); }
    catch (error) { 
      if (attempt === maxRetries) throw error; 
      await sleep(2000 * attempt); 
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
  
  // 🔥 نترجم من الفرانكو مباشرة بدون أي مسح للحروف!
  const form = toArabic(parts[1]); 
  const tag = parts[2];
  const features = parts[3].trim();

  const key = getWordKey(surah, ayah, wordNum);
  if (!wordsCache.has(key)) {
    wordsCache.set(key, { surah, ayah, wordNum, segments: [] });
  }
  wordsCache.get(key).segments.push({ segmentNum, form, tag, features });
}

async function flushWord(entry) {
  // 🔥 نجمع الكلمة من المقاطع العربية السليمة لتكون دقيقة 100%
  const fullWordText = entry.segments.map(s => s.form).join('');

  const [wordRow] = await sql`
    INSERT INTO quran_corpus_words (surah_number, ayah_number, word_position, word_text)
    VALUES (${entry.surah}, ${entry.ayah}, ${entry.wordNum}, ${fullWordText})
    ON CONFLICT (surah_number, ayah_number, word_position) 
    DO UPDATE SET word_text = ${fullWordText}
    RETURNING id
  `;
  const wordId = wordRow.id;

  for (const seg of entry.segments) {
    await sql`
      INSERT INTO quran_corpus_segments (word_id, segment_number, segment_text, tag, features)
      VALUES (${wordId}, ${seg.segmentNum}, ${seg.form}, ${seg.tag}, ${seg.features})
      ON CONFLICT (word_id, segment_number) 
      DO UPDATE SET segment_text = ${seg.form}, tag = ${seg.tag}, features = ${seg.features}
    `;
  }
}

async function main() {
  console.log('🚀 بدء ضخ اللغة العربية السليمة لقاعدة البيانات...');
  const rl = readline.createInterface({ input: fs.createReadStream(INPUT_FILE), crlfDelay: Infinity });

  let wordCount = 0;
  let currentKey = '';

  for await (const line of rl) {
    processLine(line);

    const locMatch = line.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
    if (locMatch) {
      const key = getWordKey(parseInt(locMatch[1]), parseInt(locMatch[2]), parseInt(locMatch[3]));
      
      if (currentKey && key !== currentKey) {
        const prevEntry = wordsCache.get(currentKey);
        if (prevEntry) {
          await withRetry(() => flushWord(prevEntry));
          wordsCache.delete(currentKey);
          wordCount++;
          if (wordCount % 1000 === 0) console.log(`   ✅ تم تصحيح ${wordCount} كلمة...`);
          await sleep(2); // لتخفيف الضغط
        }
      }
      currentKey = key;
    }
  }
  
  if (currentKey && wordsCache.has(currentKey)) { 
    await withRetry(() => flushWord(wordsCache.get(currentKey))); 
  }
  
  console.log(`🎉 تمت العملية بنجاح! قاعدة البيانات الآن فصحى 100%`);
  process.exit(0);
}

main().catch(console.error);