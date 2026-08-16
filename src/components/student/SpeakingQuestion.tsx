"use client";

import { useState, useRef, useEffect } from "react";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Mic,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Send,
  Volume2,
} from "lucide-react";

interface SpeakingQuestionProps {
  questionText: string; // the prompt (e.g., "Say 'Hello'")
  expectedText: string; // the correct text to compare against
  onComplete?: (score: number, passed: boolean) => void;
}

interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  errors: string[];
  suggestions: string[];
}

// TypeScript declaration for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function SpeakingQuestion({
  questionText,
  expectedText,
  onComplete,
}: SpeakingQuestionProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const recognitionRef = useRef<any>(null);

  const initializeRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA"; // Arabic, can be configured
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      setTranscript(speechResult);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      if (event.error === "no-speech") {
        toast.error("No speech detected. Please try again.");
      } else {
        toast.error(`Speech recognition error: ${event.error}`);
      }
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    return recognition;
  };

  const handleStartListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const recognition = initializeRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    setTranscript("");
    setResult(null);
    setIsListening(true);
    recognition.start();
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleEvaluate = async () => {
    if (!transcript.trim()) {
      toast.error("Please speak first or type your answer.");
      return;
    }
    setEvaluating(true);
    try {
      const res = await fetch("/api/evaluate-speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedText,
          actualText: transcript,
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
    setTranscript("");
    setResult(null);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-elegant space-y-4">
      <div>
        <h3 className="font-serif text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          <T>Speaking Practice</T>
        </h3>
        <p className="mt-2 text-muted-foreground">
          <T>Say the following sentence:</T>
        </p>
        <p className="mt-2 text-xl font-medium bg-secondary/50 rounded-xl p-4 text-center">
          {questionText}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={!window.SpeechRecognition && !window.webkitSpeechRecognition}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
            isListening
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          } disabled:opacity-50`}
        >
          <Mic className="h-4 w-4" />
          {isListening ? <T>Stop</T> : <T>Start Speaking</T>}
        </button>
        <button
          onClick={handleEvaluate}
          disabled={!transcript.trim() || evaluating}
          className="inline-flex items-center gap-2 rounded-full bg-accent/20 text-accent-foreground px-5 py-2 text-sm font-semibold hover:bg-accent/30 disabled:opacity-50"
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
          disabled={!transcript && !result}
          className="p-2 rounded-full hover:bg-accent transition disabled:opacity-50"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Transcript */}
      <div>
        <label className="text-sm font-medium">
          <T>What you said (editable)</T>
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          className="w-full rounded-xl border bg-background p-4 text-sm mt-1"
          placeholder="Transcript will appear here..."
        />
      </div>

      {/* Result */}
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