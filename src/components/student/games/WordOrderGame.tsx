"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface WordOrderGameProps {
  gameData: any;
  onComplete?: (score: number, passed: boolean) => void;
}

interface WordOrderData {
  sentence?: string;
  words?: string[];
  correct_order?: number[];
}

export default function WordOrderGame({ gameData, onComplete }: WordOrderGameProps) {
  const { user } = useAuth();
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);

  // استخراج بيانات اللعبة
  const data: WordOrderData = gameData || {};

  useEffect(() => {
    if (Array.isArray(data.words)) {
      // خلط الكلمات مبدئيًا
      const shuffled = [...data.words].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setSelectedWords([]);
      setResult(null);
    }
  }, [gameData]);

  const handleWordClick = (word: string) => {
    if (result) return; // بعد التحقق، لا يمكن التعديل
    setSelectedWords((prev) => [...prev, word]);
    setAvailableWords((prev) => prev.filter((w) => w !== word));
  };

  const handleRemoveWord = (index: number) => {
    if (result) return;
    const word = selectedWords[index];
    setSelectedWords((prev) => prev.filter((_, i) => i !== index));
    setAvailableWords((prev) => [...prev, word]);
  };

  const handleReset = () => {
    if (Array.isArray(data.words)) {
      const shuffled = [...data.words].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setSelectedWords([]);
      setResult(null);
    }
  };

  const handleCheck = async () => {
    if (selectedWords.length === 0) return;
    setIsChecking(true);

    // تحقق من الترتيب الصحيح
    const correct = Array.isArray(data.correct_order)
      ? data.correct_order.every((idx, i) => selectedWords[i] === data.words?.[idx])
      : selectedWords.join(" ") === data.sentence;

    if (correct) {
      setResult({ correct: true, message: "Correct! Well done." });
      if (onComplete) onComplete(100, true);
      toast.success("Correct!");
    } else {
      setResult({ correct: false, message: "Incorrect order. Try again." });
      if (onComplete) onComplete(0, false);
      toast.error("Not quite right.");
    }

    setIsChecking(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <T>Arrange the words to form a correct sentence.</T>
      </p>

      {/* منطقة الجملة المختارة */}
      <div className="min-h-16 rounded-2xl border-2 border-dashed border-border bg-background p-4 flex flex-wrap items-center gap-2">
        {selectedWords.length === 0 ? (
          <span className="text-muted-foreground text-sm">
            <T>Click on words below to add them here</T>
          </span>
        ) : (
          selectedWords.map((word, idx) => (
            <button
              key={`${word}-${idx}`}
              onClick={() => handleRemoveWord(idx)}
              className="rounded-full bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 transition"
            >
              {word}
            </button>
          ))
        )}
      </div>

      {/* الكلمات المتاحة */}
      <div className="flex flex-wrap gap-2">
        {availableWords.map((word, idx) => (
          <button
            key={`${word}-${idx}`}
            onClick={() => handleWordClick(word)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition"
          >
            {word}
          </button>
        ))}
      </div>

      {/* أزرار التحكم */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={selectedWords.length === 0 || isChecking || !!result}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
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