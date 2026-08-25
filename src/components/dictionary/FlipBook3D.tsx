'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FlipBook3DProps {
  pages: React.ReactNode[];
  className?: string;
  enableSound?: boolean;
  rtl?: boolean; // افتراضي true
}

const FlipBook3D: React.FC<FlipBook3DProps> = ({ pages, className, enableSound = true, rtl = true }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const flipSound = useRef<HTMLAudioElement | null>(null);

  // إعداد صوت التقليب
  const playFlipSound = useCallback(() => {
    if (!enableSound) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const duration = 0.15;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        const envelope = Math.sin(Math.PI * t);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200 + Math.random() * 800;
      filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + duration);
    } catch (err) {
      // ignore
    }
  }, [enableSound]);

  // الانتقال إلى صفحة معينة
  const goToPage = useCallback((pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= pages.length || isFlipping) return;
    setIsFlipping(true);
    playFlipSound();
    setTimeout(() => {
      setCurrentPage(pageIndex);
      setIsFlipping(false);
    }, 1000); // مدة التقليب
  }, [pages.length, isFlipping, playFlipSound]);

  const nextPage = useCallback(() => {
    if (rtl) {
      goToPage(currentPage - 1); // في RTL الصفحة التالية تكون للخلف
    } else {
      goToPage(currentPage + 1);
    }
  }, [currentPage, goToPage, rtl]);

  const prevPage = useCallback(() => {
    if (rtl) {
      goToPage(currentPage + 1);
    } else {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage, rtl]);

  return (
    <div className={cn('flex justify-center items-center p-4', className)} dir={rtl ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-3xl aspect-[3/4]">
        {/* حاوية الصفحة الحالية */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#f8ecd4] to-[#f0dfc0] text-gray-900 p-6 shadow-xl rounded-lg overflow-auto"
          style={{ transformStyle: 'preserve-3d', transition: 'transform 0.5s', transform: isFlipping ? 'rotateY(15deg)' : 'rotateY(0deg)' }}
        >
          {pages[currentPage] ?? <div className="text-center text-muted-foreground">لا توجد صفحات</div>}
        </div>

        {/* أزرار التنقل */}
        <button
          onClick={prevPage}
          disabled={currentPage === (rtl ? pages.length - 1 : 0) || isFlipping}
          className="absolute top-1/2 -translate-y-1/2 right-2 z-10 bg-black/10 hover:bg-black/20 rounded-full p-2 disabled:opacity-40"
          aria-label="الصفحة السابقة"
        >
          {rtl ? '→' : '←'}
        </button>
        <button
          onClick={nextPage}
          disabled={currentPage === (rtl ? 0 : pages.length - 1) || isFlipping}
          className="absolute top-1/2 -translate-y-1/2 left-2 z-10 bg-black/10 hover:bg-black/20 rounded-full p-2 disabled:opacity-40"
          aria-label="الصفحة التالية"
        >
          {rtl ? '←' : '→'}
        </button>

        {/* مؤشر الصفحة */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm text-gray-700 bg-white/80 px-3 py-1 rounded-full">
          {currentPage + 1} / {pages.length}
        </div>
      </div>
    </div>
  );
};

export default FlipBook3D;