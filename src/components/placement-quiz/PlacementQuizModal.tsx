"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, BookOpen, Mic, FileText, Check } from "lucide-react";
import QuizStep1 from "./QuizStep1";
import QuizStep2 from "./QuizStep2";
import QuizResult from "./QuizResult";
import type { ReadingAbility, Goal } from "@/types/student-features";

interface PlacementQuizModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PlacementQuizModal({ open, onClose }: PlacementQuizModalProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [reading, setReading] = useState<ReadingAbility | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const handleComplete = (selectedGoal: Goal) => {
    setGoal(selectedGoal);
    setStep(2);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl rounded-3xl border border-emerald-200 bg-white/95 p-8 shadow-2xl shadow-emerald-950/10"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-charcoal/60 transition-colors hover:bg-emerald-50 hover:text-charcoal"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-700 text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-charcoal">Placement Quiz</h2>
              <p className="text-sm text-charcoal/70">Find your perfect starting point in under 3 minutes.</p>
            </div>
          </div>

          <div className="mb-8 flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex items-center gap-2 ${i === 2 ? "" : "flex-1"}`}
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    i <= step ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-400"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < 2 && (
                  <div className={`h-px flex-1 ${i < step ? "bg-emerald-700" : "bg-emerald-100"}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <QuizStep1
                key="step-0"
                selected={reading}
                onSelect={(value) => {
                  setReading(value);
                  setStep(1);
                }}
              />
            )}
            {step === 1 && (
              <QuizStep2
                key="step-1"
                selected={goal}
                onBack={() => setStep(0)}
                onComplete={handleComplete}
              />
            )}
            {step === 2 && reading && goal && (
              <QuizResult
                key="step-2"
                reading={reading}
                goal={goal}
                onClose={onClose}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}