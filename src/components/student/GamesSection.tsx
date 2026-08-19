"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
// @ts-ignore
import confetti from "canvas-confetti";
import {
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Timer,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// أنواع الألعاب الخمسة
const GAMES = [
  {
    id: "word-order",
    emoji: "🧩",
    title: "Word Order",
    description: "Arrange the words to build a correct sentence.",
    gradient: "linear-gradient(135deg, #0ea5e9, #2563eb)",
  },
  {
    id: "speed-choice",
    emoji: "⚡",
    title: "Speed Choice",
    description: "Answer multiple-choice questions against the clock.",
    gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
  },
  {
    id: "matching",
    emoji: "🔗",
    title: "Matching",
    description: "Match every word with its correct meaning.",
    gradient: "linear-gradient(135deg, #10b981, #0d9488)",
  },
  {
    id: "letter-connect",
    emoji: "🔤",
    title: "Letter Connect",
    description: "Build the word from scrambled letters.",
    gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)",
  },
  {
    id: "time-race",
    emoji: "⏱️",
    title: "Time Race",
    description: "Quick-fire questions before the timer runs out.",
    gradient: "linear-gradient(135deg, #f43f5e, #ec4899)",
  },
];

const COUNTS = [5, 10, 15, 20];
const MINUTES = [1, 2, 3];

interface GameSessionQuestion {
  kind: "choice" | "sequence" | "pairs";
  prompt: string;
  options?: string[];
  tokens?: string[];
  pairs?: { left: string; right: string }[];
  answer: any;
  explanation: string;
}

interface Mistake {
  prompt: string;
  given: string;
  correct: string;
  explanation: string;
}

export default function GamesSection({
  courseId,
  difficulty,
}: {
  courseId: string;
  difficulty?: string;
}) {
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState<(typeof GAMES)[0] | null>(null);
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);

  const [questions, setQuestions] = useState<GameSessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    if (!playing || finished) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, finished]);

  const total = questions.length;
  const score = total ? Math.round((correct / total) * 100) : 0;

  const startSession = async () => {
    if (!selectedGame || !user) return;
    setLoadingSession(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/games/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameId: selectedGame.id,
          courseId,
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load questions");
      }
      setQuestions(data.questions);
      setIndex(0);
      setCorrect(0);
      setMistakes([]);
      setFinished(false);
      setSecondsLeft(minutes * 60);
      setPlaying(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to start session");
    } finally {
      setLoadingSession(false);
    }
  };

  const closeModal = () => {
    setSelectedGame(null);
    setPlaying(false);
    setQuestions([]);
  };

  const handleNext = (wasCorrect: boolean, mistake?: Mistake) => {
    if (wasCorrect) setCorrect((c) => c + 1);
    else if (mistake) setMistakes((m) => [...m, mistake]);

    if (index + 1 >= total) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const replay = () => {
    setRound((r) => r + 1);
    if (selectedGame) {
      startSession();
    }
  };

  const finish = () => {
    closeModal();
  };

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">
            <T>Practice Games</T>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <T>{`Five short games designed for level ${difficulty || "A1"}.`}</T>
          </p>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
          <T>{`${GAMES.length} games available`}</T>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => (
          <article
            key={game.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: game.gradient }}
            />
            <div>
              <div
                className="flex size-12 items-center justify-center rounded-2xl text-2xl text-white"
                style={{ background: game.gradient }}
              >
                {game.emoji}
              </div>
              <h3 className="mt-4 text-base font-extrabold">{game.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{game.description}</p>
            </div>
            <button
              onClick={() => {
                setSelectedGame(game);
                setPlaying(false);
                setCount(10);
                setMinutes(2);
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="size-4" />
              <T>Play now</T>
            </button>
          </article>
        ))}
      </div>

      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            {!playing ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-extrabold">
                    <span className="text-2xl">{selectedGame.emoji}</span>
                    {selectedGame.title}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="rounded-full p-2 text-muted-foreground hover:bg-accent"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="mb-2 text-sm font-bold">
                      <T>Number of questions</T>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {COUNTS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setCount(c)}
                          className={cn(
                            "min-w-14 rounded-xl border px-4 py-2 text-sm font-bold transition-all",
                            count === c
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-primary",
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-bold">
                      <T>Duration (minutes)</T>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MINUTES.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMinutes(m)}
                          className={cn(
                            "min-w-14 rounded-xl border px-4 py-2 text-sm font-bold transition-all",
                            minutes === m
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-primary",
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={startSession}
                    disabled={loadingSession}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loadingSession ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    <T>Start</T>
                  </button>
                </div>
              </>
            ) : (
              <GameSession
                game={selectedGame}
                questions={questions}
                index={index}
                correct={correct}
                mistakes={mistakes}
                finished={finished}
                secondsLeft={secondsLeft}
                total={total}
                onNext={handleNext}
                onFinish={finish}
                onReplay={replay}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function GameSession({
  game,
  questions,
  index,
  correct,
  mistakes,
  finished,
  secondsLeft,
  total,
  onNext,
  onFinish,
  onReplay,
}: {
  game: (typeof GAMES)[0];
  questions: GameSessionQuestion[];
  index: number;
  correct: number;
  mistakes: Mistake[];
  finished: boolean;
  secondsLeft: number;
  total: number;
  onNext: (ok: boolean, mistake?: Mistake) => void;
  onFinish: () => void;
  onReplay: () => void;
}) {
  const score = total ? Math.round((correct / total) * 100) : 0;

  if (finished) {
    const passed = score >= 50;
    return (
      <Results
        game={game}
        score={score}
        correct={correct}
        total={total}
        mistakes={mistakes}
        passed={passed}
        onReplay={onReplay}
        onExit={onFinish}
      />
    );
  }

  const q = questions[index];
  if (!q) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="text-xl">{game.emoji}</span>
          {game.title}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
          <Timer className="size-4" />
          {mm}:{ss}
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          <T>{`Question ${index + 1} of ${total}`}</T>
        </p>
      </div>

      <p className="text-lg font-bold">{q.prompt}</p>

      {q.kind === "choice" && q.options && (
        <ChoiceRound key={index} q={q as any} onDone={onNext} />
      )}
      {q.kind === "sequence" && q.tokens && (
        <SequenceRound key={index} q={q as any} onDone={onNext} />
      )}
      {q.kind === "pairs" && q.pairs && (
        <PairsRound key={index} q={q as any} onDone={onNext} />
      )}
    </div>
  );
}

function ChoiceRound({
  q,
  onDone,
}: {
  q: any;
  onDone: (ok: boolean, mistake?: Mistake) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const ok = opt === q.answer;
    setTimeout(
      () =>
        onDone(
          ok,
          ok
            ? undefined
            : {
                prompt: q.prompt,
                given: opt,
                correct: q.answer,
                explanation: q.explanation,
              },
        ),
      750,
    );
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.options!.map((opt: string) => {
        const state = !picked ? "idle" : opt === q.answer ? "right" : opt === picked ? "wrong" : "idle";
        return (
          <button
            key={opt}
            onClick={() => choose(opt)}
            dir="ltr"
            className={cn(
              "rounded-2xl border px-4 py-4 text-base font-semibold transition-all",
              state === "idle" && "border-border bg-card hover:border-primary hover:shadow-sm",
              state === "right" && "border-green-500 bg-green-50 text-green-700",
              state === "wrong" && "border-red-500 bg-red-50 text-red-700",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SequenceRound({
  q,
  onDone,
}: {
  q: any;
  onDone: (ok: boolean, mistake?: Mistake) => void;
}) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);

  const isLetterMode = q.answer[0]?.length === 1;
  const joinChar = isLetterMode ? "" : " ";
  const tokens = q.tokens!;

  const submit = () => {
    setLocked(true);
    const given = chosen.map((i) => tokens[i]).join(joinChar);
    const correct = q.answer.join(joinChar);
    const ok = given === correct;
    setTimeout(
      () =>
        onDone(
          ok,
          ok
            ? undefined
            : {
                prompt: q.prompt,
                given,
                correct,
                explanation: q.explanation,
              },
        ),
      750,
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
        {chosen.length === 0 && (
          <span className="text-sm text-muted-foreground">Tap the tokens in order…</span>
        )}
        {chosen.map((i, pos) => (
          <button
            key={`${i}-${pos}`}
            disabled={locked}
            onClick={() => setChosen((c) => c.filter((_, p) => p !== pos))}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm"
          >
            {tokens[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {tokens.map((tok: string, i: number) =>
          chosen.includes(i) ? null : (
            <button
              key={i}
              disabled={locked}
              onClick={() => setChosen((c) => [...c, i])}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold transition-all hover:border-primary hover:shadow-sm"
            >
              {tok}
            </button>
          ),
        )}
      </div>
      <button
        onClick={submit}
        disabled={chosen.length !== tokens.length || locked}
        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <T>Check</T>
      </button>
    </div>
  );
}

function PairsRound({
  q,
  onDone,
}: {
  q: any;
  onDone: (ok: boolean, mistake?: Mistake) => void;
}) {
  const rights = useMemo(() => q.pairs!.map((p: any) => p.right).sort(() => Math.random() - 0.5), [q]);
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const wrongRef = useRef(0);
  const [wrongCount, setWrongCount] = useState(0);

  const tapRight = (right: string) => {
    if (!activeLeft || matched.includes(right)) return;
    const pair = q.pairs!.find((p: any) => p.left === activeLeft)!;
    if (pair.right === right) {
      const nextMatched = [...matched, right];
      setMatched(nextMatched);
      setActiveLeft(null);
      if (nextMatched.length === q.pairs!.length) {
        const ok = wrongRef.current === 0;
        setTimeout(
          () =>
            onDone(
              ok,
              ok
                ? undefined
                : {
                    prompt: q.prompt,
                    given: `${wrongRef.current} wrong attempts`,
                    correct: q.explanation,
                    explanation: "Review the word pairs and their meanings before matching.",
                  },
            ),
          600,
        );
      }
    } else {
      wrongRef.current += 1;
      setWrongCount(wrongRef.current);
      setActiveLeft(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {q.pairs!.map((p: any) => {
            const isMatched = matched.includes(p.right);
            return (
              <button
                key={p.left}
                disabled={isMatched}
                onClick={() => setActiveLeft(p.left)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-sm font-bold transition-all",
                  isMatched
                    ? "border-green-500 bg-green-50 text-green-700"
                    : activeLeft === p.left
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary",
                )}
              >
                {p.left}
              </button>
            );
          })}
        </div>
        <div className="space-y-2" dir="ltr">
          {rights.map((r: string) => {
            const isMatched = matched.includes(r);
            return (
              <button
                key={r}
                disabled={isMatched}
                onClick={() => tapRight(r)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-sm font-bold transition-all",
                  isMatched
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-border bg-card hover:border-accent",
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <T>{`Wrong attempts: ${wrongCount}`}</T>
      </p>
    </div>
  );
}

function Results({
  game,
  score,
  correct,
  total,
  mistakes,
  passed,
  onReplay,
  onExit,
}: {
  game: (typeof GAMES)[0];
  score: number;
  correct: number;
  total: number;
  mistakes: Mistake[];
  passed: boolean;
  onReplay: () => void;
  onExit: () => void;
}) {
  useEffect(() => {
    if (passed) {
      playApplause();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [passed]);

  return (
    <div className="space-y-6 text-center">
      <div
        className="mx-auto flex size-24 items-center justify-center rounded-full text-4xl text-white"
        style={{ background: game.gradient }}
      >
        {passed ? "🎉" : "💪"}
      </div>
      <div>
        <h3 className="text-2xl font-extrabold">
          {passed ? <T>Well done!</T> : <T>So close!</T>}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {passed ? (
            <T>You passed this session — keep going.</T>
          ) : (
            <T>Try again to improve your score.</T>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-primary/10 p-3">
          <p className="text-lg font-extrabold text-primary">{score}%</p>
          <p className="text-xs text-muted-foreground"><T>Score</T></p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3">
          <p className="text-lg font-extrabold text-primary">{correct}/{total}</p>
          <p className="text-xs text-muted-foreground"><T>Correct</T></p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3">
          <p className="text-lg font-extrabold text-primary">+{correct * 10}</p>
          <p className="text-xs text-muted-foreground"><T>Points</T></p>
        </div>
      </div>

      {mistakes.length > 0 && (
        <div className="space-y-3 text-left">
          <h4 className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-accent" />
            <T>Review mistakes</T>
          </h4>
          {mistakes.map((m, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="font-semibold">{m.prompt}</p>
              <p className="mt-2 flex items-center gap-2 text-red-600">
                <XCircle className="size-4" /> <T>Your answer</T>: {m.given || "—"}
              </p>
              <p className="mt-1 flex items-center gap-2 text-green-600">
                <CheckCircle2 className="size-4" /> <T>Correct</T>: {m.correct}
              </p>
              <p className="mt-2 text-muted-foreground">{m.explanation}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onReplay}
          className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <RotateCcw className="inline size-4" /> <T>Play again</T>
        </button>
        <button
          onClick={onExit}
          className="flex-1 rounded-full border border-border px-6 py-3 text-sm font-bold hover:bg-accent"
        >
          <T>Finish</T>
        </button>
      </div>
    </div>
  );
}

function playApplause() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const duration = 2.2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.min(1, t * 6) * Math.exp(-t * 1.1);
      const claps = Math.random() < 0.06 ? 2.5 : 0.5;
      data[i] = (Math.random() * 2 - 1) * env * 0.25 * claps;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    src.connect(filter).connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch {}
}