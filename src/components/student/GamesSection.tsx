"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { Loader2, Gamepad2, Play, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import WordOrderGame from "./games/WordOrderGame";
import SpeedChoiceGame from "./games/SpeedChoiceGame";
import MatchingGame from "./games/MatchingGame";
import LetterConnectGame from "./games/LetterConnectGame";
import ColoringGame from "./games/ColoringGame";

interface GameItem {
  id: string;
  game_type: string;
  title?: string;
  game_data: any;
  difficulty?: string;
  created_at: string;
}

interface GamesSectionProps {
  courseId: string;
  difficulty?: string;
}

export default function GamesSection({ courseId, difficulty }: GamesSectionProps) {
  const { user } = useAuth();
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "fail" | null>(null);

  const fetchGames = useCallback(async () => {
    if (!user || !courseId) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ courseId });
      if (difficulty) params.append("difficulty", difficulty);
      const res = await fetch(`/api/student/games?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.games)) {
        setGames(data.games);
      } else {
        setGames([]);
      }
    } catch (error) {
      console.error("Failed to fetch games:", error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [user, courseId, difficulty]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const handleGameComplete = async (success: boolean) => {
    if (!selectedGame || !user) return;
    setSubmitting(true);
    setResult(success ? "success" : "fail");

    try {
      const token = await user.getIdToken();
      await fetch("/api/student/submit-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: selectedGame.id,
          questionType: selectedGame.game_type,
          userAnswer: success ? "correct" : "incorrect",
          correctAnswer: success ? "correct" : "incorrect",
          finalize: true,
          activitySummary: {
            totalQuestions: 1,
            correctCount: success ? 1 : 0,
            activityType: "game",
          },
        }),
      });
    } catch (error) {
      console.error("Failed to record game result:", error);
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        setSelectedGame(null);
        setResult(null);
      }, 1500);
    }
  };

  const handlePlay = (game: GameItem) => {
    setSelectedGame(game);
    setResult(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <T>Educational Games</T>
        </h2>
        <button
          onClick={fetchGames}
          className="p-2 rounded-full hover:bg-accent transition"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <T>No games available for this course yet.</T>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <div
              key={game.id}
              className="rounded-3xl border bg-card p-5 shadow-elegant hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">
                    {game.title || game.game_type.replace("_", " ")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {game.difficulty || "General"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                  <Gamepad2 className="h-5 w-5" />
                </div>
              </div>
              <button
                onClick={() => handlePlay(game)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
              >
                <Play className="h-4 w-4" />
                <T>Play</T>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal for selected game */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="bg-card rounded-3xl p-6 max-w-2xl w-full shadow-elegant space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl">
                {selectedGame.title || selectedGame.game_type.replace("_", " ")}
              </h3>
              <button
                onClick={() => {
                  setSelectedGame(null);
                  setResult(null);
                }}
                className="p-2 rounded-full hover:bg-accent transition"
              >
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* عرض اللعبة حسب النوع */}
            {selectedGame.game_type === "word_order" ? (
              <WordOrderGame
                gameData={selectedGame.game_data}
                onComplete={(score, passed) => handleGameComplete(passed)}
              />
            ) : selectedGame.game_type === "speed_choice" ? (
              <SpeedChoiceGame
                gameData={selectedGame.game_data}
                onComplete={(score, passed) => handleGameComplete(passed)}
              />
            ) : selectedGame.game_type === "matching" ? (
              <MatchingGame
                gameData={selectedGame.game_data}
                onComplete={(score, passed) => handleGameComplete(passed)}
              />
            ) : selectedGame.game_type === "letter_connect" ? (
              <LetterConnectGame
                gameData={selectedGame.game_data}
                onComplete={(score, passed) => handleGameComplete(passed)}
              />
            ) : selectedGame.game_type === "coloring" ? (
              <ColoringGame
                gameData={selectedGame.game_data}
                onComplete={(score, passed) => handleGameComplete(passed)}
                />
            )
              : (
              <div className="text-center py-8 text-muted-foreground">
                <T>This game type will be implemented soon.</T>
              </div>
            )}

            {/* رسالة النتيجة أثناء الإرسال */}
            {submitting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <T>Recording result...</T>
              </div>
            )}
            {result && !submitting && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  result === "success" ? "text-green-600" : "text-destructive"
                }`}
              >
                {result === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <T>{result === "success" ? "Completed!" : "Try again"}</T>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}