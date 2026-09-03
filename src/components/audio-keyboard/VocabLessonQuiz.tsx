"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import AudioPlayerCard from "./AudioPlayerCard";
import VirtualArabicKeyboard from "./VirtualArabicKeyboard";
import type { VocabCard } from "@/types/student-features";

interface VocabLessonQuizProps {
  card: VocabCard;
  onNext?: () => void;
}

export default function VocabLessonQuiz({ card, onNext }: VocabLessonQuizProps) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const checkAnswer = () => {
    const normalizedInput = input.trim();
    const normalizedWord = card.arabicWord.trim();
    const correct = normalizedInput === normalizedWord;
    setIsCorrect(correct);
    setSubmitted(true);
  };

  const handleReset = () => {
    setInput("");
    setSubmitted(false);
    setIsCorrect(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AudioPlayerCard card={card} />

      <div className="rounded-2xl border border-charcoal/10 bg-white/80 p-6 shadow-lg shadow-charcoal/5">
        <label className="text-sm font-semibold text-charcoal">
          Type the Arabic word you heard
        </label>

        <div className="mt-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            dir="rtl"
            className="w-full rounded-xl border border-charcoal/15 bg-cream px-4 py-3 text-2xl font-bold text-charcoal outline-none transition-colors focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="اكتب هنا"
            disabled={submitted}
          />
        </div>

        <VirtualArabicKeyboard value={input} onChange={setInput} />

        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-4 flex items-center gap-3 rounded-xl px-4 py-3 ${
                isCorrect
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {isCorrect ? (
                <>
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    Excellent! You got it right.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    Not quite. The correct word is{" "}
                    <span className="font-bold" dir="rtl">
                      {card.arabicWord}
                    </span>
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!submitted ? (
            <button
              onClick={checkAnswer}
              disabled={!input.trim()}
              className="flex-1 rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-800 disabled:opacity-50"
            >
              Check Answer
            </button>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="rounded-full border border-charcoal/20 px-5 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-charcoal/5"
              >
                Try Again
              </button>
              {onNext && (
                <button
                  onClick={onNext}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-800"
                >
                  Next Card
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}