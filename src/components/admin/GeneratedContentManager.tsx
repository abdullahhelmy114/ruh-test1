"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  RefreshCw,
  FileQuestion,
  Gamepad2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GeneratedQuestion {
  id: string;
  question_type: string;
  question_text: string;
  options: any;
  correct_answer: any;
  audio_text?: string;
  difficulty?: string;
  created_at: string;
}

interface GeneratedGame {
  id: string;
  game_type: string;
  title?: string;
  game_data: any;
  difficulty?: string;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

export default function GeneratedContentManager() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [games, setGames] = useState<GeneratedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "questions" | "games">("all");
  const [search, setSearch] = useState("");

  // جلب الكورسات من /api/course
  useEffect(() => {
    fetch("/api/course")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch courses");
        return r.json();
      })
      .then((d) => {
        const courseArray = d.course || d.courses || [];
        setCourses(courseArray);
      })
      .catch((err) => console.error("Failed to fetch courses:", err));
  }, []);

  const fetchContent = useCallback(async () => {
    if (!user || !selectedCourse) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/generated-content?courseId=${selectedCourse}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setQuestions(data.questions || []);
        setGames(data.games || []);
      } else {
        toast.error(data.error || "Failed to fetch content");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [user, selectedCourse]);

  useEffect(() => {
    if (selectedCourse) {
      fetchContent();
    } else {
      setQuestions([]);
      setGames([]);
    }
  }, [selectedCourse, fetchContent]);

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/generated-content/question`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        toast.success("Question deleted");
      }
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleDeleteGame = async (id: string) => {
    if (!confirm("Delete this game?")) return;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/generated-content/game`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== id));
        toast.success("Game deleted");
      }
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const filteredQuestions = questions.filter((q) =>
    q.question_text.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGames = games.filter(
    (g) =>
      (g.title || g.game_type).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">
            <T>Select Course</T>
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full md:w-80 rounded-xl border bg-background px-4 py-2 text-sm mt-1"
          >
            <option value="">--</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium",
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-card border hover:bg-accent"
            )}
          >
            <T>All</T>
          </button>
          <button
            onClick={() => setFilter("questions")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium",
              filter === "questions"
                ? "bg-primary text-primary-foreground"
                : "bg-card border hover:bg-accent"
            )}
          >
            <T>Questions</T>
          </button>
          <button
            onClick={() => setFilter("games")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium",
              filter === "games"
                ? "bg-primary text-primary-foreground"
                : "bg-card border hover:bg-accent"
            )}
          >
            <T>Games</T>
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full md:w-48 rounded-full border bg-background pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <button
          onClick={fetchContent}
          disabled={loading || !selectedCourse}
          className="inline-flex items-center gap-2 rounded-full bg-accent/20 text-accent-foreground px-4 py-2 text-sm font-semibold hover:bg-accent/30 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <T>Refresh</T>
        </button>
      </div>

      {!selectedCourse ? (
        <div className="text-center py-16 text-muted-foreground">
          <T>Select a course to view generated content</T>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {(filter === "all" || filter === "questions") && (
            <section>
              <h3 className="flex items-center gap-2 font-serif text-xl mb-3">
                <FileQuestion className="h-5 w-5 text-primary" />
                <T>Generated Questions</T> ({filteredQuestions.length})
              </h3>
              {filteredQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <T>No questions found</T>
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-start justify-between gap-4 rounded-2xl border bg-background p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{q.question_text}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {q.question_type}
                          </span>
                          {q.difficulty && (
                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                              {q.difficulty}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <T>Correct</T>:{" "}
                            {typeof q.correct_answer === "string"
                              ? q.correct_answer
                              : JSON.stringify(q.correct_answer)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-full text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {(filter === "all" || filter === "games") && (
            <section>
              <h3 className="flex items-center gap-2 font-serif text-xl mb-3">
                <Gamepad2 className="h-5 w-5 text-primary" />
                <T>Generated Games</T> ({filteredGames.length})
              </h3>
              {filteredGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <T>No games found</T>
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredGames.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-start justify-between gap-4 rounded-2xl border bg-background p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {g.title || g.game_type}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {g.game_type}
                          </span>
                          {g.difficulty && (
                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                              {g.difficulty}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <T>Data</T>: {JSON.stringify(g.game_data).slice(0, 60)}
                            ...
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteGame(g.id)}
                        className="p-1.5 rounded-full text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}