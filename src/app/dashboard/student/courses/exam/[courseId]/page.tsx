"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, ShieldAlert, ArrowLeft, ArrowRight, Clock, BookOpen, AlertTriangle } from "lucide-react";
import { T } from "@/components/TranslatedText";

export default function ExamPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; selected: number }[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetch(`/api/exam/${courseId}/questions`)
      .then(r => r.json())
      .then(d => setQuestions(d.questions || []))
      .finally(() => setLoading(false));
  }, [courseId, user, router]);

  // منع التصوير
  useEffect(() => {
    if (!started) return;
    const blockKeys = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.key === 'PrintScreen' || e.altKey) e.preventDefault();
    };
    const blockContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('keydown', blockKeys);
    document.addEventListener('contextmenu', blockContext);
    return () => {
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('contextmenu', blockContext);
    };
  }, [started]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (questions.length === 0) return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><T>No questions yet.</T></div>;

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 text-center max-w-md">
          <ShieldAlert className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
          <h1 className="font-serif text-2xl"><T>Exam Completed</T></h1>
          <p className="mt-4 text-lg"><T>Your Score</T>: {result.score}/{result.total}</p>
          <p className={`mt-2 font-bold ${result.passed ? 'text-emerald-500' : 'text-red-500'}`}>
            {result.passed ? <T>Passed</T> : <T>Failed</T>}
          </p>
          <button onClick={() => router.push(`/dashboard/student/courses/${courseId}`)} className="mt-6 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black">
            <T>Back to Course</T>
          </button>
        </div>
      </div>
    );
  }

  // شاشة شروط الامتحان
  if (!started) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-elegant">
          <BookOpen className="mx-auto h-12 w-12 text-secondary-foreground" />
          <h1 className="font-serif text-2xl"><T>Final Exam</T></h1>
          <div className="space-y-3 text-left text-sm text-muted-foreground bg-background/50 rounded-2xl p-4">
            <p className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-secondary-foreground mt-0.5 shrink-0" /> <T>The exam consists of 25 multiple‑choice questions randomly selected from the course material.</T></p>
            <p className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-secondary-foreground mt-0.5 shrink-0" /> <T>You must score at least 60% to pass and earn your certificate.</T></p>
            <p className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-secondary-foreground mt-0.5 shrink-0" /> <T>Once you start, you cannot pause or return to the exam. Make sure you have a stable internet connection.</T></p>
            <p className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-secondary-foreground mt-0.5 shrink-0" /> <T>Screenshots, copy/paste, and right‑click are disabled during the exam.</T></p>
          </div>
          <button onClick={() => setStarted(true)} className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-black hover:bg-amber-400">
            <Clock className="h-4 w-4" /> <T>Start Exam</T>
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const selected = answers.find(a => a.questionId === q.id)?.selected;

  const handleSelect = (index: number) => {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === q.id);
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = { questionId: q.id, selected: index };
        return copy;
      }
      return [...prev, { questionId: q.id, selected: index }];
    });
  };

  const handleNext = () => { if (current < questions.length - 1) setCurrent(c => c + 1); };
  const handlePrev = () => { if (current > 0) setCurrent(c => c - 1); };

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/exam/${courseId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.uid, answers }),
    });
    const data = await res.json();
    setResult(data);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="glass rounded-3xl p-6 md:p-10 max-w-2xl w-full shadow-elegant">
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span>{current + 1} / {questions.length}</span>
        </div>
        <h2 className="font-serif text-xl mb-6">{q.question}</h2>
        <div className="space-y-3">
          {q.options.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full text-left p-4 rounded-xl border transition ${
                selected === i ? 'bg-amber-500/20 border-amber-500' : 'hover:bg-accent'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-8">
          <button onClick={handlePrev} disabled={current === 0} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-1">
            <ArrowLeft size={16} /> <T>Previous</T>
          </button>
          {current === questions.length - 1 ? (
            <button onClick={handleSubmit} disabled={submitting} className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 className="animate-spin" /> : <T>Submit Exam</T>}
            </button>
          ) : (
            <button onClick={handleNext} disabled={selected === undefined} className="rounded-full bg-amber-500 px-6 py-2 text-sm font-semibold text-black disabled:opacity-50 flex items-center gap-1">
              <T>Next</T> <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}