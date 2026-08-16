"use client";

import { useState } from "react";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PenLine,
} from "lucide-react";

interface WritingQuestionProps {
  questionText: string; // The writing prompt or question
  onComplete?: (score: number, passed: boolean) => void;
}

interface WritingEvaluation {
  score: number;
  passed: boolean;
  feedback: string;
  corrected_text?: string;
  errors: string[];
  suggestions: string[];
}

export default function WritingQuestion({
  questionText,
  onComplete,
}: WritingQuestionProps) {
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<WritingEvaluation | null>(null);

  const handleEvaluate = async () => {
    if (!answer.trim()) {
      toast.error("Please write your answer first.");
      return;
    }
    setEvaluating(true);
    try {
      const res = await fetch("/api/evaluate-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: questionText,
          userAnswer: answer,
        }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setResult(data.result);
        if (onComplete) {
          onComplete(data.result.score, data.result.passed);
        }
        toast.success("Evaluation completed");
      } else {
        throw new Error(data.error || "Evaluation failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Network error");
    } finally {
      setEvaluating(false);
    }
  };

  const handleReset = () => {
    setAnswer("");
    setResult(null);
  };

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-elegant space-y-4">
      <div>
        <h3 className="font-serif text-lg flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" />
          <T>Writing Practice</T>
        </h3>
        <p className="mt-2 text-lg font-medium">{questionText}</p>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={5}
        className="w-full rounded-xl border bg-background p-4 text-sm leading-relaxed"
        placeholder="Write your answer here..."
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleEvaluate}
          disabled={!answer.trim() || evaluating}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {evaluating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <T>Evaluate</T>
        </button>
        <button
          onClick={handleReset}
          disabled={!answer && !result}
          className="p-2 rounded-full hover:bg-accent transition disabled:opacity-50"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {result && (
        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            result.passed ? "border-green-500/30" : "border-destructive/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.passed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <span className="font-semibold">
              <T>Score</T>: {result.score}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{result.feedback}</p>
          {result.corrected_text && (
            <div className="rounded-xl bg-secondary/50 p-3 text-sm">
              <span className="font-medium">
                <T>Corrected Answer</T>:
              </span>{" "}
              {result.corrected_text}
            </div>
          )}
          {result.errors && result.errors.length > 0 && (
            <div>
              <p className="font-medium text-sm">
                <T>Errors</T>:
              </p>
              <ul className="list-disc list-inside text-sm">
                {result.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          {result.suggestions && result.suggestions.length > 0 && (
            <div>
              <p className="font-medium text-sm">
                <T>Suggestions</T>:
              </p>
              <ul className="list-disc list-inside text-sm">
                {result.suggestions.map((sug, idx) => (
                  <li key={idx}>{sug}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}