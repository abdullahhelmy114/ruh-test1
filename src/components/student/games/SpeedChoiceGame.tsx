"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Timer, RotateCcw } from "lucide-react";

interface SpeedChoiceGameProps {
  gameData: any;
  onComplete?: (score: number, passed: boolean) => void;
}

interface SpeedChoiceData {
  question?: string;
  options?: string[];
  correct_index?: number;
  time_limit_seconds?: number;
}

export default function SpeedChoiceGame({ gameData, onComplete }: SpeedChoiceGameProps) {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const data: SpeedChoiceData = gameData || {};

  useEffect(() => {
    const initialTime = data.time_limit_seconds || 10;
    setTimeLeft(initialTime);
    setSelectedOption(null);
    setResult(null);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameData]);

  const handleTimeout = () => {
    if (result) return;
    setResult({ correct: false, message: "Time is up!" });
    if (onComplete) onComplete(0, false);
  };

  const handleSelectOption = (index: number) => {
    if (result || selectedOption !== null) return; // يمكن التعديل قبل التحقق
    setSelectedOption(index);
  };

  const handleConfirm = () => {
    if (selectedOption === null) return;
    setIsChecking(true);
    const correct = selectedOption === data.correct_index;
    setResult({ correct, message: correct ? "Correct! Well done." : "Incorrect. Try again." });
    if (onComplete) onComplete(correct ? 100 : 0, correct);
    setIsChecking(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleReset = () => {
    const initialTime = data.time_limit_seconds || 10;
    setTimeLeft(initialTime);
    setSelectedOption(null);
    setResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Timer */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Timer className="h-4 w-4" />
        <span>
          <T>Time Left</T>: {timeLeft}s
        </span>
      </div>

      {/* Question */}
      <p className="text-lg font-medium">{data.question}</p>

      {/* Options */}
      <div className="space-y-3">
        {Array.isArray(data.options) &&
          data.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectOption(idx)}
              disabled={!!result}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                selectedOption === idx
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent/50"
              } ${result && idx === data.correct_index ? "border-green-500/30 bg-green-50" : ""}`}
            >
              <span className="text-sm">{option}</span>
            </button>
          ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleConfirm}
          disabled={selectedOption === null || isChecking || !!result}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <T>Confirm</T>
        </button>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition"
        >
          <RotateCcw className="h-4 w-4" />
          <T>Reset</T>
        </button>
      </div>

      {/* Result */}
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