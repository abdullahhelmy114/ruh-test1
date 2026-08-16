"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Upload,
  Sparkles,
  XCircle,
  BrainCircuit,
  Gamepad2,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

type QuestionType =
  | "choice"
  | "true_false"
  | "fill_blank"
  | "word_order"
  | "matching"
  | "listening"
  | "writing"
  | "speaking";

type GameType =
  | "word_order"
  | "speed_choice"
  | "matching"
  | "letter_connect"
  | "time_race"
  | "coloring";

interface Course {
  id: string;
  title: string;
}

interface PDFExtractorProps {
  difficulty?: string;
}

export default function PDFExtractor({ difficulty = "A1" }: PDFExtractorProps) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isGeneratingGames, setIsGeneratingGames] = useState(false);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["choice", "true_false"]);
  const [gameTypes, setGameTypes] = useState<GameType[]>(["word_order", "speed_choice"]);
  const [countPerType, setCountPerType] = useState(3);
  const [saveToCourse, setSaveToCourse] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // جلب الكورسات من /api/course
  useEffect(() => {
    fetch("/api/course")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch courses");
        return r.json();
      })
      .then((d) => {
        const arr = d.course || d.courses || [];
        setCourses(arr);
      })
      .catch((err) => console.error("Failed to fetch courses:", err));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setError("");
    } else {
      setSelectedFile(null);
      setError("Please select a valid PDF file.");
    }
  };

  const handleExtract = async () => {
    if (!selectedFile || !user) return;
    setIsExtracting(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/extract-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExtractedText(data.text);
        toast.success("PDF text extracted successfully");
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract text");
      toast.error(err.message || "Failed to extract text");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!extractedText.trim() || questionTypes.length === 0 || !user) return;
    if (saveToCourse && !selectedCourseId) {
      toast.error("Please select a course to save questions.");
      return;
    }
    setIsGeneratingQuestions(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const payload: any = {
        sourceText: extractedText,
        questionTypes,
        countPerType,
        difficulty,
      };
      if (saveToCourse && selectedCourseId) {
        payload.courseId = selectedCourseId;
        payload.save = true;
      }
      const res = await fetch("/api/admin/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Generated ${data.questions?.length || 0} questions`);
        if (data.savedIds?.length) {
          toast.success(`Saved ${data.savedIds.length} questions to course`);
        }
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate questions");
      toast.error(err.message || "Failed to generate questions");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleGenerateGames = async () => {
    if (!extractedText.trim() || gameTypes.length === 0 || !user) return;
    if (saveToCourse && !selectedCourseId) {
      toast.error("Please select a course to save games.");
      return;
    }
    setIsGeneratingGames(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const payload: any = {
        sourceText: extractedText,
        gameTypes,
        countPerType,
        difficulty,
      };
      if (saveToCourse && selectedCourseId) {
        payload.courseId = selectedCourseId;
        payload.save = true;
      }
      const res = await fetch("/api/admin/generate-games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Generated ${data.games?.length || 0} games`);
        if (data.savedIds?.length) {
          toast.success(`Saved ${data.savedIds.length} games to course`);
        }
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate games");
      toast.error(err.message || "Failed to generate games");
    } finally {
      setIsGeneratingGames(false);
    }
  };

  const toggleQuestionType = (type: QuestionType) => {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleGameType = (type: GameType) => {
    setGameTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <FileText className="h-5 w-5 text-primary" />
          <T>PDF Text Extractor</T>
        </h2>
        <div className="mt-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-accent transition"
          >
            <Upload className="h-4 w-4" />
            {selectedFile ? selectedFile.name : <T>Choose PDF</T>}
          </button>
          <button
            type="button"
            onClick={handleExtract}
            disabled={!selectedFile || isExtracting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Loader2 className={`h-4 w-4 ${isExtracting ? "animate-spin" : "hidden"}`} />
            <FileText className={`h-4 w-4 ${isExtracting ? "hidden" : ""}`} />
            <T>Extract Text</T>
          </button>
          {selectedFile && (
            <span className="text-xs text-muted-foreground">
              <T>Selected</T>: {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      {/* Extracted Text / Editor */}
      {extractedText && (
        <div className="rounded-3xl border bg-card p-6 shadow-elegant">
          <h3 className="flex items-center gap-2 font-serif text-lg">
            <FileText className="h-4 w-4 text-primary" />
            <T>Extracted Text (Editable)</T>
          </h3>
          <textarea
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
            rows={10}
            className="mt-3 w-full rounded-2xl border bg-background p-4 text-sm leading-relaxed"
            placeholder="Extracted text will appear here..."
          />
          {extractedText.length > 12000 && (
            <p className="mt-2 text-xs text-amber-600">
              <T>Note: Text is long, only first 12000 characters will be used for generation.</T>
            </p>
          )}
        </div>
      )}

      {/* Generation Options */}
      {extractedText && (
        <div className="rounded-3xl border bg-card p-6 shadow-elegant space-y-6">
          <h3 className="flex items-center gap-2 font-serif text-lg">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <T>Generate Content</T>
          </h3>

          {/* Course Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-primary" />
              <T>Select Course to Save</T>
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="mt-1 w-full md:w-80 rounded-xl border bg-background px-4 py-2 text-sm"
            >
              <option value="">--</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Questions */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-foreground" />
                <T>Question Types</T>
              </h4>
              <div className="flex flex-wrap gap-2">
                {(["choice", "true_false", "fill_blank", "word_order", "matching", "listening", "writing", "speaking"] as QuestionType[]).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleQuestionType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      questionTypes.includes(type)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={isGeneratingQuestions || questionTypes.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Loader2 className={`h-4 w-4 ${isGeneratingQuestions ? "animate-spin" : "hidden"}`} />
                <Sparkles className={`h-4 w-4 ${isGeneratingQuestions ? "hidden" : ""}`} />
                <T>Generate Questions</T>
              </button>
            </div>

            {/* Games */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-accent-foreground" />
                <T>Game Types</T>
              </h4>
              <div className="flex flex-wrap gap-2">
                {(["word_order", "speed_choice", "matching", "letter_connect", "time_race", "coloring"] as GameType[]).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleGameType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      gameTypes.includes(type)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGenerateGames}
                disabled={isGeneratingGames || gameTypes.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Loader2 className={`h-4 w-4 ${isGeneratingGames ? "animate-spin" : "hidden"}`} />
                <Gamepad2 className={`h-4 w-4 ${isGeneratingGames ? "hidden" : ""}`} />
                <T>Generate Games</T>
              </button>
            </div>
          </div>

          {/* Common settings */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">
                <T>Count per Type</T>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={countPerType}
                onChange={(e) => setCountPerType(Number(e.target.value))}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                <T>Difficulty</T>
              </label>
              <input
                value={difficulty}
                disabled
                className="w-full rounded-xl border bg-muted px-3 py-2 text-sm mt-1 cursor-not-allowed"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saveToCourse}
                  onChange={(e) => setSaveToCourse(e.target.checked)}
                  disabled={!selectedCourseId}
                  className="rounded"
                />
                <T>Save to Course</T>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <XCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}