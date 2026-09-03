// أنواع اختبار تحديد المستوى
export type ReadingAbility = "yes" | "no" | "little";
export type Goal = "quranic" | "modern" | "conversational";

export interface QuizResultData {
  level: string;
  title: string;
  description: string;
  path: string[];
  duration: string;
}

// أنواع بطاقات المعلمين
export interface Instructor {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  accentColor: string;
  videoPreviewUrl?: string;
}

// أنواع لوحة التحكم التحفيزية
export interface GamifiedStats {
  dayStreak: number;
  xpPoints: number;
  level: number;
  referralLink: string;
}

// أنواع بطاقة المفردات الصوتية
export interface VocabCard {
  id: string;
  arabicWord: string;
  transliteration: string;
  englishMeaning: string;
  audioUrl?: string;
}

// أنواع سرعة التشغيل الصوتي
export type AudioSpeed = 1.0 | 0.75 | 0.5;