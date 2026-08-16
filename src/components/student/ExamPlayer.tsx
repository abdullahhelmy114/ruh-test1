"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Timer,
  FileQuestion,
  Mic,
  PenLine,
  Send,
} from "lucide-react";

// Types
interface ExamQuestion {
  id: string;
  question_type: string;
  question_text: string;
  options?: string[] | null;
  correct_answer?: any;
  audio_url?: string | null;
  audio_text?: string | null;
}

interface ExamData {
  examId: string;
  questions: ExamQuestion[];
  timeLimitSeconds?: number;
}

interface Answer {
  questionId: string;
  answer: any; // string / number / array / object
}

interface ExamResult {
  score: number;
  passed: boolean;
  points_awarded: number;
  feedback?: string;
}

export default function ExamPlayer({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startExam = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/start-exam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (res.ok && data.exam) {
        setExam(data.exam);
        setAnswers({});
        setCurrentIndex(0);
        setResult(null);
        if (data.exam.timeLimitSeconds) {
          setTimeLeft(data.exam.timeLimitSeconds);
        }
      } else {
        toast.error(data.error || "Failed to start exam");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => {
    startExam();
  }, [startExam]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const goToNext = () => {
    if (currentIndex < (exam?.questions.length || 0) - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!exam || !user) return;
    // Ensure all questions answered? optional
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const payload = {
        examId: exam.examId,
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
      };
      const res = await fetch("/api/student/submit-exam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.result);
        toast.success("Exam submitted successfully");
      } else {
        toast.error(data.error || "Failed to submit exam");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <T>No exam available.</T>
        <button
          onClick={startExam}
          className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
        >
          <T>Start Exam</T>
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-3xl border bg-card p-8 shadow-elegant text-center space-y-6">
        <div className="flex justify-center">
          {result.passed ? (
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          ) : (
            <XCircle className="h-16 w-16 text-destructive" />
          )}
        </div>
        <h2 className="font-serif text-2xl">
          <T>Exam Completed</T>
        </h2>
        <p className="text-lg">
          <T>Score</T>: {result.score}%
        </p>
        <p className="text-lg">
          <T>Points Earned</T>: {result.points_awarded}
        </p>
        {result.feedback && (
          <p className="text-sm text-muted-foreground">{result.feedback}</p>
        )}
        <button
          onClick={startExam}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
        >
          <T>Retake Exam</T>
        </button>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentIndex];
  const isLast = currentIndex === exam.questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <FileQuestion className="h-5 w-5 text-primary" />
          <T>Exam</T>
        </h2>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Timer className="h-4 w-4" />
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {exam.questions.length}
          </span>
          <span className="text-sm text-muted-foreground">
            <T>Answered</T>: {answeredCount}
          </span>
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-3xl border bg-card p-6 shadow-elegant">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {currentQuestion.question_type.replace("_", " ")}
          </span>
          {currentQuestion.audio_url && (
            <audio controls src={currentQuestion.audio_url} className="max-w-[200px]" />
          )}
        </div>
        <p className="text-lg font-medium">{currentQuestion.question_text}</p>

        {/* Render based on question type */}
        <div className="mt-6">
          {currentQuestion.question_type === "choice" && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((opt, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition ${
                    answers[currentQuestion.id] === opt
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={opt}
                    checked={answers[currentQuestion.id] === opt}
                    onChange={() => handleAnswerChange(currentQuestion.id, opt)}
                    className="hidden"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.question_type === "true_false" && (
            <div className="space-y-3">
              {["true", "false"].map((val) => (
                <label
                  key={val}
                  className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition ${
                    answers[currentQuestion.id] === val
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={val}
                    checked={answers[currentQuestion.id] === val}
                    onChange={() => handleAnswerChange(currentQuestion.id, val)}
                    className="hidden"
                  />
                  <span className="text-sm">
                    {val === "true" ? <T>True</T> : <T>False</T>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.question_type === "fill_blank" && (
            <input
              type="text"
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm"
              placeholder="..."
            />
          )}

          {currentQuestion.question_type === "writing" && (
            <textarea
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              rows={4}
              className="w-full rounded-xl border bg-background p-4 text-sm"
              placeholder="Write your answer..."
            />
          )}

          {currentQuestion.question_type === "speaking" && (
            <div className="text-center text-muted-foreground">
              <Mic className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2"><T>Speaking questions will be available soon.</T></p>
            </div>
          )}

          {currentQuestion.question_type === "word_order" && (
            <div className="text-center text-muted-foreground">
              <p><T>Word order question type is not implemented yet.</T></p>
            </div>
          )}

          {currentQuestion.question_type === "matching" && (
            <div className="text-center text-muted-foreground">
              <p><T>Matching question type is not implemented yet.</T></p>
            </div>
          )}

          {currentQuestion.question_type === "listening" && (
            <div className="space-y-3">
              {currentQuestion.audio_text && (
                <div className="rounded-2xl bg-secondary p-4 text-sm">
                  <T>Listen and choose:</T> {currentQuestion.audio_text}
                </div>
              )}
              {/* placeholder: we will implement audio playback via TTS later */}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <T>Previous</T>
        </button>
        <button
          onClick={isLast ? handleSubmit : goToNext}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLast ? (
            <>
              <Send className="h-4 w-4" /> <T>Submit</T>
            </>
          ) : (
            <>
              <T>Next</T> <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}