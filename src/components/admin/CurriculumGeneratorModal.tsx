"use client";

import { groqJSONCompletion, simpleGroqCompletion } from "@/lib/groq-client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  X,
  Upload,
  FileText,
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  Play,
  ChevronLeft,
  BarChart3,
  AlertCircle,
} from "lucide-react";


interface LessonOutline {
  title: string;
  description?: string;
}

interface CurriculumGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  onLessonsGenerated?: () => void;
}

type Step = "setup" | "preview" | "progress";

export default function CurriculumGeneratorModal({
  isOpen,
  onClose,
  courseId,
  onLessonsGenerated,
}: CurriculumGeneratorModalProps) {
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("setup");

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [level, setLevel] = useState("A1");
  const [instructions, setInstructions] = useState("");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [generateVideo, setGenerateVideo] = useState(false);
  const [quizCount, setQuizCount] = useState(10);

  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);

  const [outlineLessons, setOutlineLessons] = useState<LessonOutline[]>([]);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [outlineError, setOutlineError] = useState("");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [completedLessons, setCompletedLessons] = useState<number>(0);
  const [totalLessons, setTotalLessons] = useState<number>(0);
  const [taskStatus, setTaskStatus] = useState<string>("pending");
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep("setup");
      setSelectedFiles([]);
      setInstructions("");
      setOutlineLessons([]);
      setTaskId(null);
      setProgress(0);
      setTaskStatus("pending");
      setErrorMessage("");
      setExtractedText("");
      setShowExtractedText(false);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setExtractedText("");
      setShowExtractedText(false);
    }
  };

  const handleExtractText = async () => {
    if (!user || selectedFiles.length === 0) {
      toast.error("Please select at least one PDF file.");
      return;
    }

    setIsExtracting(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));

      const res = await fetch("/api/admin/curriculum/extract-text", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to extract text");
      }

      setExtractedText(data.text || "");
      setShowExtractedText(true);
      toast.success("Text extracted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to extract text");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!user || selectedFiles.length === 0) {
      toast.error("Please select at least one PDF file.");
      return;
    }

    setIsGeneratingOutline(true);
    setOutlineError("");
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      formData.append("level", level);
      formData.append("instructions", instructions);

      const res = await fetch("/api/admin/curriculum/outline", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate outline");
      }

      setOutlineLessons(data.lessons || []);
      setStep("preview");
    } catch (error: any) {
      setOutlineError(error.message);
      toast.error(error.message || "Failed to generate outline");
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!user || outlineLessons.length === 0) return;

    try {
      const token = await user.getIdToken();

      const settings = {
        courseId,
        level,
        instructions,
        generateAudio,
        generateVideo,
        quizCount,
        sourceText: extractedText,
      };

      const res = await fetch("/api/admin/curriculum/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          lessons: outlineLessons,
          settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start generation");
      }

      setTaskId(data.taskId);
      setProgress(0);
      setTaskStatus("pending");
      setStep("progress");

      pollTaskStatus(data.taskId);
    } catch (error: any) {
      toast.error(error.message || "Failed to start generation");
    }
  };

  const pollTaskStatus = (taskId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = await user?.getIdToken();
        if (!token) return;

        const res = await fetch(`/api/admin/curriculum/status?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          clearInterval(pollIntervalRef.current!);
          setTaskStatus("failed");
          setErrorMessage(data.error || "Failed to fetch status");
          return;
        }

        setProgress(data.progress || 0);
        setCompletedLessons(data.completed_lessons || 0);
        setTotalLessons(data.total_lessons || 0);
        setTaskStatus(data.status);

        if (data.status === "completed") {
          clearInterval(pollIntervalRef.current!);
          toast.success("Curriculum generated successfully!");
          if (onLessonsGenerated) onLessonsGenerated();
          setTimeout(() => onClose(), 1500);
        } else if (data.status === "failed") {
          clearInterval(pollIntervalRef.current!);
          setErrorMessage(data.error_message || "Generation failed");
          toast.error(data.error_message || "Generation failed");
        }
      } catch (error) {
        clearInterval(pollIntervalRef.current!);
        setErrorMessage("Failed to fetch status");
      }
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-bold font-serif mb-1 flex items-center gap-2">
          <BrainCircuit className="text-primary" />
          <T>AI Full Curriculum Generator</T>
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          <T>Upload PDF books and instructions to generate complete lessons.</T>
        </p>

        {step === "setup" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold mb-2">
                <T>Upload PDF Files (multiple)</T>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileChange}
                className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer text-muted-foreground"
              />
              {selectedFiles.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {selectedFiles.map((file, i) => (
                    <li key={i}>📄 {file.name}</li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleExtractText}
                  disabled={isExtracting || selectedFiles.length === 0}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isExtracting ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <FileText size={16} />
                  )}
                  <T>استخراج النص</T>
                </button>

                {showExtractedText && (
                  <button
                    onClick={() => setShowExtractedText(!showExtractedText)}
                    className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-sm font-semibold transition-colors"
                  >
                    {showExtractedText ? <T>إخفاء النص</T> : <T>عرض النص</T>}
                  </button>
                )}
              </div>

              {showExtractedText && (
                <div className="mt-3">
                  <label className="text-sm font-bold mb-1 block">
                    <T>النص المستخرج (قابل للتعديل)</T>
                  </label>
                  <textarea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    rows={8}
                    className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary text-sm leading-relaxed"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">
                  <T>Target Level</T>
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary"
                >
                  {["A1", "A2", "B1", "B2", "C1"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">
                  <T>Quiz Questions per Lesson</T>
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quizCount}
                  onChange={(e) => setQuizCount(Number(e.target.value))}
                  className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                <T>Additional AI Instructions</T>
              </label>
              <textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., أنشئ دروس مدتها 45-60 دقيقة، للطلاب غير الناطقين بالعربية، مع صوتيات للجمل العربية وفيديو يوتيوب لكل درس"
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={(e) => setGenerateAudio(e.target.checked)}
                  className="rounded"
                />
                <T>Generate audio for sentences</T>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={generateVideo}
                  onChange={(e) => setGenerateVideo(e.target.checked)}
                  className="rounded"
                />
                <T>Search YouTube video for each lesson</T>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={handleGenerateOutline}
                disabled={isGeneratingOutline || selectedFiles.length === 0}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
              >
                {isGeneratingOutline ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
                <T>Generate Lesson Outline</T>
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg">
              <T>{`Lesson Outline Preview (${outlineLessons.length} lessons)`}</T>
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background p-3">
              {outlineLessons.map((lesson, idx) => (
                <div key={idx} className="flex items-start gap-2 py-2 border-b last:border-0">
                  <span className="w-6 h-6 rounded-full bg-secondary text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{lesson.title}</p>
                    {lesson.description && (
                      <p className="text-xs text-muted-foreground">{lesson.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={() => setStep("setup")}
                className="px-5 py-2 rounded-xl border border-border hover:bg-secondary text-sm font-semibold transition-colors"
              >
                <ChevronLeft className="inline h-4 w-4" /> <T>Back</T>
              </button>
              <button
                onClick={handleStartGeneration}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md"
              >
                <Play size={16} /> <T>Start Generation</T>
              </button>
            </div>
          </div>
        )}

        {step === "progress" && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <BarChart3 className="mx-auto h-10 w-10 text-primary" />
              <h3 className="font-semibold text-lg">
                <T>Generating Lessons...</T>
              </h3>
              <p className="text-sm text-muted-foreground">
                <T>{`${completedLessons}/${totalLessons} lessons completed`}</T>
              </p>
            </div>

            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs font-semibold">{progress}%</p>

            {taskStatus === "failed" && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div>
                  <p><T>Generation failed</T></p>
                  <p className="text-xs mt-1">{errorMessage}</p>
                </div>
              </div>
            )}

            {taskStatus === "completed" && (
              <div className="text-center text-green-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <span><T>Completed successfully!</T></span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}