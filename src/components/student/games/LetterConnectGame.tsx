"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface LetterConnectGameProps {
  gameData: any;
  onComplete?: (score: number, passed: boolean) => void;
}

interface LetterConnectData {
  word?: string;
  letters?: string[];
  correct_order?: number[];
}

export default function LetterConnectGame({ gameData, onComplete }: LetterConnectGameProps) {
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);

  const data: LetterConnectData = gameData || {};

  useEffect(() => {
    if (Array.isArray(data.letters)) {
      const shuffled = [...data.letters].sort(() => Math.random() - 0.5);
      setAvailableLetters(shuffled);
      setSelectedLetters([]);
      setResult(null);
    }
  }, [gameData]);

  const handleLetterClick = (letter: string) => {
    if (result) return;
    setSelectedLetters((prev) => [...prev, letter]);
    setAvailableLetters((prev) => prev.filter((l) => l !== letter));
  };

  const handleRemoveLetter = (index: number) => {
    if (result) return;
    const letter = selectedLetters[index];
    setSelectedLetters((prev) => prev.filter((_, i) => i !== index));
    setAvailableLetters((prev) => [...prev, letter]);
  };

  const handleReset = () => {
    if (Array.isArray(data.letters)) {
      const shuffled = [...data.letters].sort(() => Math.random() - 0.5);
      setAvailableLetters(shuffled);
      setSelectedLetters([]);
      setResult(null);
    }
  };

  const handleCheck = () => {
    if (selectedLetters.length === 0) return;

    let isCorrect = false;

    // الحالة الأولى: لدينا correct_order
    if (Array.isArray(data.correct_order) && data.correct_order.length === selectedLetters.length) {
      isCorrect = data.correct_order.every(
        (idx, i) => selectedLetters[i] === data.letters?.[idx]
      );
    }
    // الحالة الثانية: لدينا word والمقارنة النصية
    else if (data.word) {
      const constructedWord = selectedLetters.join("");
      isCorrect = constructedWord === data.word;
    }

    if (isCorrect) {
      setResult({ correct: true, message: "Correct! You formed the word." });
      if (onComplete) onComplete(100, true);
      toast.success("Correct!");
    } else {
      setResult({ correct: false, message: "Not correct. Try again." });
      if (onComplete) onComplete(0, false);
      toast.error("Wrong order.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <T>Arrange the letters to form the correct word.</T>
      </p>

      {/* منطقة الحروف المختارة */}
      <div className="min-h-16 rounded-2xl border-2 border-dashed border-border bg-background p-4 flex flex-wrap items-center gap-2">
        {selectedLetters.length === 0 ? (
          <span className="text-muted-foreground text-sm">
            <T>Click letters below to build the word</T>
          </span>
        ) : (
          selectedLetters.map((letter, idx) => (
            <button
              key={`${letter}-${idx}`}
              onClick={() => handleRemoveLetter(idx)}
              className="rounded-full bg-primary/10 text-primary px-4 py-2 text-lg font-bold hover:bg-primary/20 transition"
            >
              {letter}
            </button>
          ))
        )}
      </div>

      {/* الحروف المتاحة */}
      <div className="flex flex-wrap gap-2">
        {availableLetters.map((letter, idx) => (
          <button
            key={`${letter}-${idx}`}
            onClick={() => handleLetterClick(letter)}
            className="rounded-full border border-border bg-card px-4 py-2 text-lg font-bold hover:bg-accent transition"
          >
            {letter}
          </button>
        ))}
      </div>

      {/* أزرار التحكم */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={selectedLetters.length === 0 || !!result}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          <T>Check</T>
        </button>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition"
        >
          <RotateCcw className="h-4 w-4" />
          <T>Reset</T>
        </button>
      </div>

      {/* النتيجة */}
      {result && (
        <div
          className={`rounded-2xl border p-4 flex items-center gap-2 ${
            result.correct ? "border-green-500/30" : "border-destructive/30"
          }`}
        >
          {result.correct ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <span className="text-sm">{result.message}</span>
        </div>
      )}
    </div>
  );
}