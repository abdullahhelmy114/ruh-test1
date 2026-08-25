'use client';

// إدارة بسيطة لتشغيل الصوتيات ومنع تداخلها
let currentAudio: HTMLAudioElement | null = null;

/**
 * تشغيل صوت من رابط مع إيقاف أي صوت سابق
 */
export function playAudio(url: string): void {
  if (!url) return;
  // إيقاف الصوت الحالي إن وجد
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audio = new Audio(url);
  currentAudio = audio;
  audio.play().catch((err) => {
    console.error('Failed to play audio:', err);
  });
}

/**
 * إيقاف أي صوت قيد التشغيل
 */
export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * تحميل مسبق لصوت (اختياري)
 */
export function preloadAudio(url: string): void {
  if (!url) return;
  const audio = new Audio();
  audio.src = url;
  audio.preload = 'auto';
}