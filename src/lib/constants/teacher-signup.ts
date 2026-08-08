import { ALL_COUNTRIES } from './countries';
import { ALL_LANGUAGES } from './languages';

// أنواع البيانات المساعدة
export interface Country {
  code: string;
  name: string;
  phoneCode: string;
}

export interface Language {
  code: string;
  name: string;
}

export interface ProficiencyLevel {
  value: string;
  label: string;
}

// قائمة جميع الدول (مستوردة من countries.ts)
export const COUNTRIES: Country[] = ALL_COUNTRIES;

// قائمة اللغات
export const LANGUAGES = ALL_LANGUAGES;


// مستويات إتقان اللغة
export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  { value: 'native', label: 'Native' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

// أنواع الجنس
export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;