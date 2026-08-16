"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Palette } from "lucide-react";

interface ColoringGameProps {
  gameData: any;
  onComplete?: (score: number, passed: boolean) => void;
}

interface ColoringData {
  word?: string;
  image_hint?: string;
}

const AVAILABLE_COLORS = [
  "#ef4444", // أحمر
  "#f97316", // برتقالي
  "#eab308", // أصفر
  "#22c55e", // أخضر
  "#3b82f6", // أزرق
  "#8b5cf6", // بنفسجي
  "#ec4899", // وردي
  "#78716c", // رمادي
];

export default function ColoringGame({ gameData, onComplete }: ColoringGameProps) {
  const { user } = useAuth();
  const [selectedColor, setSelectedColor] = useState<string>(AVAILABLE_COLORS[0]);
  const [coloredLetters, setColoredLetters] = useState<Record<number, string>>({});
  const [completed, setCompleted] = useState(false);

  const data: ColoringData = gameData || {};
  const word = data.word || "";
  const letters = word.split("");

  useEffect(() => {
    setColoredLetters({});
    setCompleted(false);
    setSelectedColor(AVAILABLE_COLORS[0]);
  }, [gameData]);

  const handleLetterClick = (index: number) => {
    if (completed) return;
    setColoredLetters((prev) => ({
      ...prev,
      [index]: selectedColor,
    }));
  };

  const handleReset = () => {
    setColoredLetters({});
    setCompleted(false);
  };

  const handleComplete = () => {
    const totalLetters = letters.length;
    const coloredCount = Object.keys(coloredLetters).length;

    if (coloredCount < totalLetters) {
      toast.error(`Please color all letters (${coloredCount}/${totalLetters})`);
      return;
    }

    setCompleted(true);
    if (onComplete) onComplete(100, true);
    toast.success("Great job! You colored the word.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <T>Select a color, then click on each letter to color it.</T>
      </p>

      {/* لوحة الألوان */}
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setSelectedColor(color)}
            className={`h-8 w-8 rounded-full border-2 transition ${
              selectedColor === color ? "border-foreground scale-110" : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`color ${color}`}
          />
        ))}
      </div>

      {/* الحروف */}
      <div className="flex flex-wrap justify-center gap-2">
        {letters.map((letter, idx) => (
          <button
            key={idx}
            onClick={() => handleLetterClick(idx)}
            className={`h-16 w-16 rounded-2xl border-2 border-border text-3xl font-bold flex items-center justify-center transition ${
              completed ? "opacity-80" : ""
            }`}
            style={{
              backgroundColor: coloredLetters[idx] || "transparent",
              color: coloredLetters[idx] ? "#ffffff" : "inherit",
            }}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* أزرار التحكم */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleComplete}
          disabled={completed}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          <T>Complete</T>
        </button>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition"
        >
          <RotateCcw className="h-4 w-4" />
          <T>Reset</T>
        </button>
      </div>

      {completed && (
        <div className="rounded-2xl border border-green-500/30 p-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="text-sm">
            <T>Completed!</T>
          </span>
        </div>
      )}
    </div>
  );
}