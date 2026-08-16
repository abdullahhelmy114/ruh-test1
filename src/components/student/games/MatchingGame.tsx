"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface MatchingGameProps {
  gameData: any;
  onComplete?: (score: number, passed: boolean) => void;
}

interface MatchingData {
  pairs?: { left: string; right: string }[];
  correct_mapping?: Record<string, string>;
}

export default function MatchingGame({ gameData, onComplete }: MatchingGameProps) {
  const { user } = useAuth();
  const [leftItems, setLeftItems] = useState<string[]>([]);
  const [rightItems, setRightItems] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);

  // استخراج الأزواج الصحيحة من gameData
  const correctPairs: Record<string, string> =
    gameData?.correct_mapping ||
    gameData?.pairs?.reduce((acc: Record<string, string>, pair: { left: string; right: string }) => {
      acc[pair.left] = pair.right;
      return acc;
    }, {}) ||
    {};

  useEffect(() => {
    if (gameData?.pairs) {
      const left = gameData.pairs.map((p: any) => p.left);
      const right = gameData.pairs.map((p: any) => p.right);
      // خلط العناصر
      setLeftItems(shuffleArray(left));
      setRightItems(shuffleArray(right));
      setMatchedPairs({});
      setSelectedLeft(null);
      setResult(null);
    }
  }, [gameData]);

  const shuffleArray = (arr: string[]): string[] => {
    return [...arr].sort(() => Math.random() - 0.5);
  };

  const handleLeftClick = (item: string) => {
    if (result || matchedPairs[item]) return;
    setSelectedLeft(item);
  };

  const handleRightClick = (item: string) => {
    if (result || !selectedLeft) return;

    // التحقق من التطابق
    const leftItem = selectedLeft;
    if (correctPairs[leftItem] === item) {
      // تطابق صحيح
      setMatchedPairs((prev) => ({ ...prev, [leftItem]: item }));
      setSelectedLeft(null);
    } else {
      // تطابق خاطئ
      setResult({ correct: false, message: "Incorrect match, try again." });
      toast.error("Not a match");
      setSelectedLeft(null);
    }
  };

  const checkCompletion = () => {
    const totalPairs = Object.keys(correctPairs).length;
    const matchedCount = Object.keys(matchedPairs).length;
    if (matchedCount === totalPairs) {
      setResult({ correct: true, message: "All matched correctly!" });
      if (onComplete) onComplete(100, true);
    } else {
      setResult({ correct: false, message: `Matched ${matchedCount}/${totalPairs}` });
      if (onComplete) onComplete(0, false);
    }
  };

  const handleReset = () => {
    if (gameData?.pairs) {
      const left = gameData.pairs.map((p: any) => p.left);
      const right = gameData.pairs.map((p: any) => p.right);
      setLeftItems(shuffleArray(left));
      setRightItems(shuffleArray(right));
      setMatchedPairs({});
      setSelectedLeft(null);
      setResult(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <T>Click a left item, then click its matching right item.</T>
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">
            <T>Left</T>
          </h4>
          {leftItems.map((item) => {
            const isMatched = !!matchedPairs[item];
            const isSelected = selectedLeft === item;
            return (
              <button
                key={item}
                onClick={() => handleLeftClick(item)}
                disabled={isMatched || !!result}
                className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                  isMatched
                    ? "bg-green-50 border-green-500/30 line-through"
                    : isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent/50"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">
            <T>Right</T>
          </h4>
          {rightItems.map((item) => {
            const isMatched = Object.values(matchedPairs).includes(item);
            return (
              <button
                key={item}
                onClick={() => handleRightClick(item)}
                disabled={isMatched || !!result}
                className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                  isMatched
                    ? "bg-green-50 border-green-500/30 line-through"
                    : "hover:bg-accent/50"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={checkCompletion}
          disabled={Object.keys(matchedPairs).length === 0 || !!result}
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