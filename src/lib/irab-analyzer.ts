// lib/irab-analyzer.ts

// ========== الأنواع ==========
export type WordType = 'اسم' | 'فعل' | 'حرف' | 'ضمير' | 'اسم_اشارة' | 'اسم_موصول' | 'ظرف' | 'مبني';

export interface IrabComponent {
  text: string;
  type: WordType;
  position: string;
  sign: string;
}

export interface AnalysisResult {
  word: string;
  components: IrabComponent[];
}

// ========== قوائم lookup ==========
const PRONOUNS = new Set([
  'هُوَ', 'هِيَ', 'هُمَا', 'هُمْ', 'هُنَّ', 'أَنْتَ', 'أَنْتِ', 'أَنْتُمَا', 'أَنْتُمْ', 'أَنْتُنَّ',
  'أَنَا', 'نَحْنُ', 'هُ', 'هَا', 'هُم', 'كَ', 'كِ', 'كُمَا', 'كُمْ', 'كُنَّ',
  'نَا', 'ي', 'تُمْ', 'تُمَا', 'تُنَّ', 'تِ', 'نَ', 'هُنَّ'
]);

const DEMONSTRATIVES = new Set([
  'هَذَا', 'هَذِهِ', 'هَذَانِ', 'هَاتَانِ', 'هَؤُلَاءِ', 'ذَلِكَ', 'تِلْكَ',
  'ذَانِكَ', 'تَانِكَ', 'أُولَئِكَ', 'هَٰذَا', 'هَٰذِهِ', 'هَٰؤُلَاءِ'
]);

const RELATIVES = new Set([
  'الَّذِي', 'الَّتِي', 'اللَّذَانِ', 'اللَّتَانِ', 'الَّذِينَ',
  'اللَّاتِي', 'اللَّائِي', 'مَنْ', 'مَا'
]);

const PREPOSITIONS = new Set([
  'بِ', 'لِ', 'فِي', 'مِن', 'إِلَى', 'عَلَى', 'عَنْ', 'كَ', 'حَتَّى',
  'مُنْذُ', 'مُذْ', 'رُبَّ', 'وَ', 'تَ', 'خَلَا', 'عَدَا', 'حَاشَا'
]);

const CONJUNCTIONS = new Set(['وَ', 'فَ', 'ثُمَّ', 'أَو']);

const NASIKH_LETTERS = new Set(['إِنَّ', 'أَنَّ', 'لَكِنَّ', 'لَعَلَّ', 'كَأَنَّ', 'لَيْتَ']);
const KANA_GROUP = new Set([
  'كَانَ', 'أَصْبَحَ', 'أَمْسَى', 'أَضْحَى', 'ظَلَّ', 'بَاتَ', 'صَارَ',
  'لَيْسَ', 'مَا زَالَ', 'مَا بَرِحَ', 'مَا ٱنْفَكَّ', 'مَا فَتِئَ', 'مَا دَامَ'
]);

// ========== دوال التحليل ==========

/** تفكيك الكلمة إلى أجزاء (حروف + جذر) بشكل ذكي */
function splitWord(word: string): string[] {
  if (PRONOUNS.has(word) || DEMONSTRATIVES.has(word) || RELATIVES.has(word) || NASIKH_LETTERS.has(word)) {
    return [word];
  }
  const parts: string[] = [];
  let remaining = word;

  // التعامل مع واو العطف أو فاء العطف في البداية
  if (remaining.startsWith('وَ') && remaining.length > 1) {
    parts.push('وَ');
    remaining = remaining.substring(1);
  } else if (remaining.startsWith('فَ') && remaining.length > 1) {
    parts.push('فَ');
    remaining = remaining.substring(1);
  }

  // التعامل مع حروف الجر المتصلة (بِـ, لِـ, كَـ, etc.)
  if (remaining.length > 1 && (remaining.startsWith('بِ') || remaining.startsWith('لِ') || remaining.startsWith('كَ') || remaining.startsWith('مِن') || remaining.startsWith('فِي') || remaining.startsWith('عَلَى'))) {
    // التحقق من حروف الجر الأطول أولاً
    let foundPreposition = false;
    for (const prep of ['فِي', 'عَلَى', 'مِن', 'بِ', 'لِ', 'كَ']) {
      if (remaining.startsWith(prep)) {
        parts.push(prep);
        remaining = remaining.substring(prep.length);
        foundPreposition = true;
        break;
      }
    }
    if (!foundPreposition) {
      // إذا لم نجد حرف جر معروف، نضيف الحرف الأول كحرف (قد يكون حرف جر غير متوقع)
      parts.push(remaining[0]);
      remaining = remaining.substring(1);
    }
  }

  // الباقي هو الاسم/الفعل
  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

/** تحديد نوع الكلمة البسيط */
function determineType(word: string): WordType {
  if (PRONOUNS.has(word)) return 'ضمير';
  if (DEMONSTRATIVES.has(word)) return 'اسم_اشارة';
  if (RELATIVES.has(word)) return 'اسم_موصول';
  if (PREPOSITIONS.has(word) || NASIKH_LETTERS.has(word)) return 'حرف';
  if (CONJUNCTIONS.has(word) || ['إِلَّا', 'لَا', 'مَا', 'هَل', 'أَ', 'يَا', 'لَم', 'لَمَّا', 'لَنْ', 'كَيْ', 'إِنْ', 'سَ', 'سَوْفَ'].includes(word)) return 'حرف';
  if (word.endsWith('ٌ') || word.endsWith('ٍ') || word.endsWith('ً') || word.startsWith('ال')) return 'اسم';
  if (word.match(/^[ي|ت|أ|ن].*[َ|ِ|ُ]/)) return 'فعل';
  return 'اسم';
}

/** شجرة القرار لتحديد الموقع الإعرابي لقطعة */
function determinePosition(
  parts: string[],
  index: number,
  allParts: string[],
  prevResults: IrabComponent[]
): string {
  const current = parts[index];
  const prevPart = index > 0 ? parts[index - 1] : null;
  const prevComp = index > 0 ? prevResults[index - 1] : null;

  // الحروف دائمًا مبنية
  if (determineType(current) === 'حرف') {
    return 'لا محل له من الإعراب';
  }
  // الضمائر وأسماء الإشارة والموصولات مبنية
  if (PRONOUNS.has(current) || DEMONSTRATIVES.has(current) || RELATIVES.has(current)) {
    if (prevPart && PREPOSITIONS.has(prevPart)) {
      return 'مبني على السكون في محل جر';
    }
    return 'مبني';
  }

  // قواعد الجار والمجرور
  if (prevPart && PREPOSITIONS.has(prevPart)) {
    return 'مجرور_بحرف_جر';
  }
  // إن وأخواتها
  if (prevPart && NASIKH_LETTERS.has(prevPart)) return 'اسم_ان';
  if (index >= 2 && NASIKH_LETTERS.has(parts[index - 2]) && prevComp?.position === 'اسم_ان') return 'خبر_ان';
  // كان وأخواتها
  if (prevPart && KANA_GROUP.has(prevPart)) return 'اسم_ان';
  if (index >= 2 && KANA_GROUP.has(parts[index - 2]) && prevComp?.position === 'اسم_ان') return 'خبر_ان';

  // المبتدأ والخبر
  if (index === 0 || (prevComp?.type === 'حرف' && determineType(current) !== 'حرف')) return 'مبتدأ';
  if (prevComp?.position === 'مبتدأ') return 'خبر';
  if (prevComp?.type === 'فعل') return 'فاعل';
  if (prevComp?.position === 'فاعل') return 'مفعول_به';
  if (prevComp?.type === 'اسم' && current.startsWith('ال')) return 'مضاف_إليه';
  if (prevComp?.type === 'اسم' && (current.endsWith('ٌ') || current.endsWith('ٍ'))) return 'نعت';

  return 'غير_محدد';
}

/** تحديد العلامة الإعرابية */
function determineSign(word: string, type: WordType, position: string): string {
  if (type === 'حرف' || position === 'لا محل له من الإعراب') return 'لا محل له من الإعراب';
  if (['ضمير', 'اسم_اشارة', 'اسم_موصول'].includes(type)) {
    if (position.includes('مبني على السكون في محل')) {
      return position; // استخدمنا الجملة الكاملة كعلامة للبناء
    }
    return `مبني على السكون`;
  }
  if (word.endsWith('انِ') || word.endsWith('يْنِ')) {
    return position.includes('جر') || position.includes('نصب') ? 'منصوب/مجرور بالياء' : 'مرفوع بالألف';
  }
  if (word.endsWith('ونَ') || word.endsWith('ِينَ')) {
    return position.includes('جر') || position.includes('نصب') ? 'منصوب/مجرور بالياء' : 'مرفوع بالواو';
  }
  if (['مبتدأ', 'خبر', 'فاعل'].includes(position)) return 'مرفوع بالضمة';
  if (['مفعول_به', 'اسم_ان', 'خبر_ان'].includes(position)) return 'منصوب بالفتحة';
  if (['مجرور_بحرف_جر', 'مضاف_إليه'].includes(position)) return 'مجرور بالكسرة';
  return 'مرفوع بالضمة';
}

// ========== الدالة الرئيسية ==========
export function analyzeVerse(words: { arabic_text: string }[]): AnalysisResult[] {
  const allParts: string[] = [];
  const wordMap: number[] = [];
  words.forEach((w, wi) => {
    const parts = splitWord(w.arabic_text);
    parts.forEach(p => {
      allParts.push(p);
      wordMap.push(wi);
    });
  });

  const partResults: IrabComponent[] = [];
  allParts.forEach((part, i) => {
    const type = determineType(part);
    const position = determinePosition(allParts, i, allParts, partResults);
    const sign = determineSign(part, type, position);
    partResults.push({ text: part, type, position, sign });
  });

  const results: AnalysisResult[] = words.map(w => ({ word: w.arabic_text, components: [] }));
  partResults.forEach((comp, i) => {
    const wi = wordMap[i];
    results[wi].components.push(comp);
  });

  return results;
}