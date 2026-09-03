"use client";

import { useState, useCallback } from "react";
import type { ReadingAbility, Goal } from "@/types/student-features";

export type QuizStep = 0 | 1 | 2;

export function usePlacementQuiz() {
  const [step, setStep] = useState<QuizStep>(0);
  const [reading, setReading] = useState<ReadingAbility | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const selectReading = useCallback((value: ReadingAbility) => {
    setReading(value);
    setStep(1);
  }, []);

  const selectGoal = useCallback((value: Goal) => {
    setGoal(value);
    setStep(2);
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => (prev > 0 ? (prev - 1) as QuizStep : prev));
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setReading(null);
    setGoal(null);
    setIsSaved(false);
  }, []);

  const saveResults = useCallback(() => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
    }, 1200);
  }, []);

  return {
    step,
    reading,
    goal,
    isSaving,
    isSaved,
    selectReading,
    selectGoal,
    goBack,
    reset,
    saveResults,
  };
}