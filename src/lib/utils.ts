import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * دالة دمج كلاسات Tailwind بطريقة ذكية وتجنب التعارضات
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}