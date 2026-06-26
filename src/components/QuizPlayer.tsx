"use client";
import { useState } from "react";
import { T } from "@/components/TranslatedText";
import { CheckCircle, XCircle } from "lucide-react";

interface QuizPlayerProps {
  quizzes: any[];
  onComplete?: () => void;          // ✅
}

export function QuizPlayer({ quizzes, onComplete }: QuizPlayerProps) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!quizzes.length) return <p className="text-muted-foreground"><T>No quiz for this lesson.</T></p>;
  const q = quizzes[current];

  const handleAnswer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    if (index === q.correct) setScore(s => s + 1);
    setTimeout(() => {
      if (current < quizzes.length - 1) {
        setCurrent(c => c + 1);
        setSelected(null);
      } else {
        setFinished(true);
        onComplete?.();            // ✅ أُضيف
      }
    }, 1000);
  };

  if (finished) return (
    <div className="text-center p-6 glass rounded-3xl">
      <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
      <h2 className="font-serif text-2xl"><T>Quiz Completed!</T></h2>
      <p className="text-lg mt-2"><T>Your Score</T>: {score}/{quizzes.length}</p>
    </div>
  );

  return (
    <div className="glass rounded-3xl p-6 space-y-4">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{current + 1}/{quizzes.length}</span>
        <span><T>Score</T>: {score}</span>
      </div>
      <h3 className="font-serif text-lg">{q.question}</h3>
      <div className="space-y-2">
        {q.options.map((opt: string, i: number) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            disabled={selected !== null}
            className={`w-full text-left p-3 rounded-xl border transition ${
              selected === null
                ? "hover:bg-accent"
                : selected === i
                ? i === q.correct
                  ? "bg-emerald-100 border-emerald-500 dark:bg-emerald-900/30"
                  : "bg-red-100 border-red-500 dark:bg-red-900/30"
                : i === q.correct
                ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20"
                : "opacity-50"
            }`}
          >
            {opt}
            {selected !== null && i === q.correct && (
              <CheckCircle size={16} className="inline ml-2 text-emerald-500" />
            )}
            {selected === i && i !== q.correct && (
              <XCircle size={16} className="inline ml-2 text-red-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}