"use client";

import { useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { AudioSpeed, VocabCard } from "@/types/student-features";

interface AudioPlayerCardProps {
  card: VocabCard;
}

const SPEED_OPTIONS: { value: AudioSpeed; label: string }[] = [
  { value: 1.0, label: "1.0x" },
  { value: 0.75, label: "0.75x" },
  { value: 0.5, label: "0.5x" },
];

export default function AudioPlayerCard({ card }: AudioPlayerCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<AudioSpeed>(1.0);

  const togglePlay = () => setIsPlaying((prev) => !prev);

  const resetPlayback = () => {
    setIsPlaying(false);
    setSpeed(1.0);
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white/80 p-6 shadow-lg shadow-emerald-950/5 backdrop-blur-sm">
      {/* رأس البطاقة */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Vocabulary Card
          </p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-charcoal">
            {card.englishMeaning}
          </h3>
          <p className="mt-1 text-sm text-charcoal/60">{card.transliteration}</p>
        </div>
        <button
          onClick={resetPlayback}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-charcoal/60 transition-colors hover:bg-emerald-50 hover:text-charcoal"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* الكلمة العربية */}
      <div className="mt-6 text-center" dir="rtl">
        <p className="text-5xl font-bold text-emerald-800">{card.arabicWord}</p>
      </div>

      {/* أزرار التشغيل والسرعة */}
      <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <button
          onClick={togglePlay}
          className="grid h-14 w-14 place-items-center rounded-full bg-emerald-700 text-white shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-800"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>

        <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/60 p-1">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSpeed(option.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                speed === option.value
                  ? "bg-emerald-700 text-white"
                  : "text-charcoal/70 hover:bg-emerald-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* ملاحظة سرعة التشغيل */}
      <p className="mt-4 text-center text-xs text-charcoal/50">
        {speed === 1.0
          ? "Normal speed"
          : speed === 0.75
            ? "Slowed 25% for clarity"
            : "Slowed 50% for careful listening"}
      </p>
    </div>
  );
}