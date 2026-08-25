export interface Word {
  id: number;
  word_ar: string;
  plural_ar?: string | null;
  antonym_ar?: string | null;
  meaning_en?: string | null;
  meaning_tr?: string | null;
  is_quranic: boolean;
  audio_url?: string | null;
  created_at: string;
}

export interface QuranVerse {
  id: number;
  surah_number: number;
  ayah_number: number;
  text_ar: string;
  audio_url?: string | null;
}

export interface QuranVerseOccurrence {
  surah_number: number;
  ayah_number: number;
  text_ar: string;
  word_position: number;
}

export interface WordVerseLink {
  id: number;
  word_id: number;
  verse_id: number;
}

export type Language = 'en' | 'ar' | 'tr';
export type ViewMode = 'simple' | 'advanced';

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

export interface WordWithExamples extends Word {
  verses: QuranVerse[];
}

// أنواع معجم اللغة العربية المعاصرة
export interface DictionaryMeaning {
  definition: string;
}

export interface DictionaryEntry {
  id: number;
  entry_number: number;
  root: string;
  word: string;
  word_type?: string | null;
  meanings: DictionaryMeaning[];
  part?: number | null;
  page?: number | null;
}

// أنواع الإعراب
export interface IrabWord {
  word: string;
  analysis: string;
}

export interface QuranAnalysis {
  id: number;
  surah_number: number;
  ayah_numbers: number[];
  irab?: string | null;
  sarf?: string | null;
  balagha?: string | null;
  fawaid?: string | null;
  part?: number | null;
  page?: number | null;
  ayah_text?: string | null;
  irab_words: IrabWord[];
}