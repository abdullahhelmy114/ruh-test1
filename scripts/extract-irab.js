// scripts/extract-irab.js
// استخراج كتاب الجدول في إعراب القرآن الكريم إلى JSON
// مع دمج السجلات المكررة

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '..', 'data', 'irab.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'irab.json');

// تحويل الأرقام العربية المشرقية إلى إنجليزية
function convertArabicDigits(input) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const englishDigits = '0123456789';
  return input.replace(/[٠-٩]/g, d => englishDigits[arabicDigits.indexOf(d)]);
}

// إزالة التشكيل وتوحيد الهمزات وتنظيف المسافات
function normalizeLine(input) {
  return input
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

const text = fs.readFileSync(INPUT_FILE, 'utf8');
const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

const surahRegex = /^سورة\s+(.+)$/u;
const ayahBlockStartRegex = /^﴿(.+)﴾$/u;
const sectionRegex = /^(الاعراب|الصرف|البلاغة|الفوايد|فوايد)/u;
const pageInfoRegex = /^الجزء:\s*(\d+)\s*-\s*الصفحة:\s*(\d+)$/u;

const surahMap = {
  'الفاتحة': 1, 'البقرة': 2, 'ال عمران': 3, 'النساء': 4, 'المائدة': 5,
  'الانعام': 6, 'الاعراف': 7, 'الانفال': 8, 'التوبة': 9, 'يونس': 10,
  'هود': 11, 'يوسف': 12, 'الرعد': 13, 'ابراهيم': 14, 'الحجر': 15,
  'النحل': 16, 'الاسراء': 17, 'الكهف': 18, 'مريم': 19, 'طه': 20,
  'الانبياء': 21, 'الحج': 22, 'المؤمنون': 23, 'النور': 24, 'الفرقان': 25,
  'الشعراء': 26, 'النمل': 27, 'القصص': 28, 'العنكبوت': 29, 'الروم': 30,
  'لقمان': 31, 'السجدة': 32, 'الاحزاب': 33, 'سبا': 34, 'فاطر': 35,
  'يس': 36, 'الصافات': 37, 'ص': 38, 'الزمر': 39, 'غافر': 40,
  'فصلت': 41, 'الشورى': 42, 'الزخرف': 43, 'الدخان': 44, 'الجاثية': 45,
  'الاحقاف': 46, 'محمد': 47, 'الفتح': 48, 'الحجرات': 49, 'ق': 50,
  'الذاريات': 51, 'الطور': 52, 'النجم': 53, 'القمر': 54, 'الرحمن': 55,
  'الواقعة': 56, 'الحديد': 57, 'المجادلة': 58, 'الحشر': 59, 'الممتحنة': 60,
  'الصف': 61, 'الجمعة': 62, 'المنافقون': 63, 'التغابن': 64, 'الطلاق': 65,
  'التحريم': 66, 'الملك': 67, 'القلم': 68, 'الحاقة': 69, 'المعارج': 70,
  'نوح': 71, 'الجن': 72, 'المزمل': 73, 'المدثر': 74, 'القيامة': 75,
  'الانسان': 76, 'المرسلات': 77, 'النبأ': 78, 'النازعات': 79, 'عبس': 80,
  'التكوير': 81, 'الانفطار': 82, 'المطففين': 83, 'الانشقاق': 84, 'البروج': 85,
  'الطارق': 86, 'الاعلى': 87, 'الغاشية': 88, 'الفجر': 89, 'البلد': 90,
  'الشمس': 91, 'الليل': 92, 'الضحى': 93, 'الشرح': 94, 'التين': 95,
  'العلق': 96, 'القدر': 97, 'البينة': 98, 'الزلزلة': 99, 'العاديات': 100,
  'القارعة': 101, 'التكاثر': 102, 'العصر': 103, 'الهمزة': 104, 'الفيل': 105,
  'قريش': 106, 'الماعون': 107, 'الكوثر': 108, 'الكافرون': 109, 'النصر': 110,
  'المسد': 111, 'الاخلاص': 112, 'الفلق': 113, 'الناس': 114,
};

let currentSurah = { name: '', number: 0 };
let currentAyah = null;
let currentSection = null;
let results = [];
let buffer = [];

function finalizeAyah() {
  if (currentAyah) {
    if (currentSection === 'irab') currentAyah.irab = buffer.join('\n').trim();
    else if (currentSection === 'sarf') currentAyah.sarf = buffer.join('\n').trim();
    else if (currentSection === 'balagha') currentAyah.balagha = buffer.join('\n').trim();
    else if (currentSection === 'fawaid') currentAyah.fawaid = buffer.join('\n').trim();

    currentAyah.irab_words = parseIrabToWords(currentAyah.irab);

    results.push(currentAyah);
    currentAyah = null;
  }
}

function setSection(sectionName) {
  if (currentSection && currentAyah) {
    if (currentSection === 'irab') currentAyah.irab = buffer.join('\n').trim();
    else if (currentSection === 'sarf') currentAyah.sarf = buffer.join('\n').trim();
    else if (currentSection === 'balagha') currentAyah.balagha = buffer.join('\n').trim();
    else if (currentSection === 'fawaid') currentAyah.fawaid = buffer.join('\n').trim();
  }
  currentSection = sectionName;
  buffer = [];
}

function parseIrabToWords(irabText) {
  if (!irabText) return [];

  const results = [];
  const regex = /\(([^)]+)\)\s*([^(]*)/g;
  let match;

  while ((match = regex.exec(irabText)) !== null) {
    let word = match[1].trim();
    let analysis = match[2].trim();

    if (word.startsWith('^')) continue;

    analysis = analysis.replace(/^[،,]\s*/, '').trim();

    results.push({ word, analysis });
  }

  return results;
}

function extractAyahNumbers(ayahText) {
  const matches = ayahText.match(/\((\d+)\)/g);
  if (!matches) return [];
  return matches.map(m => parseInt(m.replace(/[()]/g, '')));
}

// دمج السجلات المكررة
function mergeDuplicateAyahs(records) {
  const map = new Map();

  for (const record of records) {
    const key = `${record.surah_number}:${(record.ayah_numbers || []).join(',')}`;
    if (!map.has(key)) {
      map.set(key, record);
      continue;
    }

    const existing = map.get(key);
    for (const field of ['irab', 'sarf', 'balagha', 'fawaid', 'irab_words']) {
      const existingVal = existing[field];
      const newVal = record[field];
      if (!existingVal || (newVal && newVal.length > existingVal.length)) {
        existing[field] = newVal;
      }
    }
    if (record.ayah_numbers && record.ayah_numbers.length > existing.ayah_numbers.length) {
      existing.ayah_numbers = record.ayah_numbers;
    }
  }

  return Array.from(map.values());
}

let sectionCounts = { irab: 0, sarf: 0, balagha: 0, fawaid: 0 };

for (let i = 0; i < lines.length; i++) {
  const originalLine = lines[i];
  const line = convertArabicDigits(originalLine);
  const normalized = normalizeLine(line);

  const surahMatch = normalized.match(surahRegex);
  if (surahMatch) {
    finalizeAyah();
    const surahName = normalizeLine(surahMatch[1].trim());
    currentSurah = { name: surahName, number: surahMap[surahName] || 0 };
    continue;
  }

  const pageMatch = normalized.match(pageInfoRegex);
  if (pageMatch) {
    if (currentAyah) {
      currentAyah.part = parseInt(pageMatch[1]);
      currentAyah.page = parseInt(pageMatch[2]);
    }
    continue;
  }

  const ayahStartMatch = normalized.match(ayahBlockStartRegex);
  if (ayahStartMatch) {
    finalizeAyah();
    const ayahText = ayahStartMatch[1].trim();
    currentAyah = {
      surah_name: currentSurah.name,
      surah_number: currentSurah.number,
      ayah_text: ayahText,
      ayah_numbers: extractAyahNumbers(ayahText),
      irab: '',
      sarf: '',
      balagha: '',
      fawaid: '',
      irab_words: [],
      part: null,
      page: null,
    };
    currentSection = null;
    buffer = [];
    continue;
  }

  const sectionMatch = normalized.match(sectionRegex);
  if (sectionMatch && currentAyah) {
    const rawName = sectionMatch[1];
    const sectionMap = {
      'الاعراب': 'irab',
      'الصرف': 'sarf',
      'البلاغة': 'balagha',
      'الفوايد': 'fawaid',
      'فوايد': 'fawaid',
    };
    const mapped = sectionMap[rawName] || null;
    if (mapped) {
      setSection(mapped);
      sectionCounts[mapped]++;
      continue;
    }
  }

  if (currentAyah && currentSection) {
    buffer.push(originalLine);
  }
}

finalizeAyah();

// دمج التكرارات
const mergedResults = mergeDuplicateAyahs(results);
console.log(`🔀 قبل الدمج: ${results.length} سجل`);
console.log(`🔀 بعد الدمج: ${mergedResults.length} سجل`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mergedResults, null, 2), 'utf8');
console.log(`✅ تم حفظ ${mergedResults.length} آية/مجموعة آيات.`);
console.log('📊 الأقسام:', sectionCounts);
console.log(`📄 الملف المحفوظ: ${OUTPUT_FILE}`);