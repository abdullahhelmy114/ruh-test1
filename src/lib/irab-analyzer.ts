// src/lib/irab-analyzer.ts

// ========== الأنواع ==========
export type WordType = 'اسم' | 'فعل' | 'حرف' | 'ضمير' | 'اسم_اشارة' | 'اسم_موصول' | 'ظرف' | 'مبني';

export type GramPosition =
  | 'مبتدأ' | 'خبر' | 'فاعل' | 'مفعول_به' | 'مضاف_إليه'
  | 'جار_ومجرور' | 'معطوف' | 'نعت' | 'حال' | 'تمييز' | 'بدل'
  | 'مبني' | 'غير_محدد' | 'مجرور_بحرف_جر' | 'اسم_ان' | 'خبر_ان';

export interface IrabSign {
  text: string;
  type: 'اصلية' | 'فرعية';
}

export interface AnalysisResult {
  word: string;
  type: WordType;
  position: GramPosition;
  sign: IrabSign;
}

// ========== قوائم lookup (مبنية) ==========
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

// حروف الجر
const PREPOSITIONS = new Set([
  'بِ', 'لِ', 'فِي', 'مِن', 'إِلَى', 'عَلَى', 'عَنْ', 'كَ', 'حَتَّى',
  'مُنْذُ', 'مُذْ', 'رُبَّ', 'وَ', 'تَ', 'خَلَا', 'عَدَا', 'حَاشَا'
]);

// إن وأخواتها
const NASIKH_LETTERS = new Set(['إِنَّ', 'أَنَّ', 'لَكِنَّ', 'لَعَلَّ', 'كَأَنَّ', 'لَيْتَ']);

// كان وأخواتها
const KANA_GROUP = new Set([
  'كَانَ', 'أَصْبَحَ', 'أَمْسَى', 'أَضْحَى', 'ظَلَّ', 'بَاتَ', 'صَارَ',
  'لَيْسَ', 'مَا زَالَ', 'مَا بَرِحَ', 'مَا ٱنْفَكَّ', 'مَا فَتِئَ', 'مَا دَامَ'
]);

// ========== الدوال الأساسية ==========

/** تحديد ما إذا كانت الكلمة حرفاً (جر، عطف، نصب، إلخ) */
function isParticle(word: string): boolean {
  return PREPOSITIONS.has(word) ||
    NASIKH_LETTERS.has(word) ||
    ['وَ', 'فَ', 'ثُمَّ', 'أَو', 'إِلَّا', 'لَا', 'مَا', 'هَل', 'أَ', 'يَا', 'لَم', 'لَمَّا', 'لَنْ', 'كَيْ', 'إِنْ', 'سَ', 'سَوْفَ'].includes(word);
}

/** تحديد نوع الكلمة (صرفي) */
function determineType(word: string): WordType {
  if (PRONOUNS.has(word)) return 'ضمير';
  if (DEMONSTRATIVES.has(word)) return 'اسم_اشارة';
  if (RELATIVES.has(word)) return 'اسم_موصول';
  if (isParticle(word)) return 'حرف';
  if (word.endsWith('ٌ') || word.endsWith('ٍ') || word.endsWith('ً') || word.startsWith('ال')) return 'اسم';
  if (word.match(/^[ي|ت|أ|ن].*[َ|ِ|ُ]/)) return 'فعل';
  return 'اسم';
}

/** شجرة القرار للموقع الإعرابي */
function determinePosition(words: string[], index: number, prevResults: AnalysisResult[]): GramPosition {
  const current = words[index];
  const prev = index > 0 ? words[index - 1] : null;
  const prevAnalysis = index > 0 ? prevResults[index - 1] : null;

  if (isParticle(current) || PRONOUNS.has(current) || DEMONSTRATIVES.has(current) || RELATIVES.has(current))
    return 'مبني';

  if (prev && PREPOSITIONS.has(prev)) return 'مجرور_بحرف_جر';
  if (prev && NASIKH_LETTERS.has(prev)) return 'اسم_ان';
  if (index >= 2 && NASIKH_LETTERS.has(words[index - 2]) && prevAnalysis?.position === 'اسم_ان') return 'خبر_ان';
  if (prev && KANA_GROUP.has(prev)) return 'اسم_ان'; // اسم كان مرفوع (تبسيط)
  if (index >= 2 && KANA_GROUP.has(words[index - 2]) && prevAnalysis?.position === 'اسم_ان') return 'خبر_ان'; // خبر كان منصوب

  if (index === 0 || (prevAnalysis?.type === 'حرف' && !isParticle(current))) return 'مبتدأ';
  if (prevAnalysis?.position === 'مبتدأ') return 'خبر';
  if (prevAnalysis?.type === 'فعل') return 'فاعل';
  if (prevAnalysis?.position === 'فاعل') return 'مفعول_به';
  if (prevAnalysis?.type === 'اسم' && current.startsWith('ال')) return 'مضاف_إليه';
  if (prevAnalysis?.type === 'اسم' && (current.endsWith('ٌ') || current.endsWith('ٍ'))) return 'نعت';

  return 'غير_محدد';
}

/** تحديد العلامة الإعرابية */
function determineSign(word: string, type: WordType, position: GramPosition): IrabSign {
  if (position === 'مبني' || type === 'حرف') return { text: 'مبني على السكون', type: 'اصلية' };
  if (['ضمير', 'اسم_اشارة', 'اسم_موصول'].includes(type)) return { text: 'مبني في محل ' + (position.includes('جر') ? 'جر' : position.includes('نصب') ? 'نصب' : 'رفع'), type: 'اصلية' };

  // علامات فرعية للمثنى والجمع
  if (word.endsWith('انِ') || word.endsWith('يْنِ')) {
    return { text: position.includes('جر') || position.includes('نصب') ? 'منصوب/مجرور بالياء' : 'مرفوع بالألف', type: 'فرعية' };
  }
  if (word.endsWith('ونَ') || word.endsWith('ِينَ')) {
    return { text: position.includes('جر') || position.includes('نصب') ? 'منصوب/مجرور بالياء' : 'مرفوع بالواو', type: 'فرعية' };
  }

  // علامات أصلية
  if (['مبتدأ', 'خبر', 'فاعل'].includes(position)) return { text: 'مرفوع بالضمة', type: 'اصلية' };
  if (['مفعول_به', 'اسم_ان', 'خبر_ان'].includes(position)) return { text: 'منصوب بالفتحة', type: 'اصلية' };
  if (['مجرور_بحرف_جر', 'مضاف_إليه'].includes(position)) return { text: 'مجرور بالكسرة', type: 'اصلية' };

  return { text: 'مرفوع بالضمة', type: 'اصلية' };
}

// ========== الدالة الرئيسية ==========
export function analyzeVerse(words: { arabic_text: string }[]): AnalysisResult[] {
  const texts = words.map(w => w.arabic_text);
  const results: AnalysisResult[] = [];

  texts.forEach((word, i) => {
    const type = determineType(word);
    const position = determinePosition(texts, i, results);
    const sign = determineSign(word, type, position);
    results.push({ word, type, position, sign });
  });

  return results;
}