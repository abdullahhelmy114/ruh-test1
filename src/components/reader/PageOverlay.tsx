// src/components/reader/PageOverlay.tsx
"use client";

import { useState } from "react";
import { X, Play, Volume2, HelpCircle, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── أنواع ──────────────────────────────────────────
export interface OverlayItem {
  id: string;
  type: "audio" | "video" | "quiz" | "game";
  position: { x: number; y: number; width: number; height: number };
  content: any; // يختلف حسب النوع
}

interface Props {
  items: OverlayItem[];
  pageWidth?: number;  // العرض الفعلي للصفحة (افتراضي 400)
  pageHeight?: number; // الارتفاع الفعلي (افتراضي 550)
  role: "admin" | "student" | "teacher" | "organization" | "guest";
}

// ── مكونات فرعية حسب النوع ────────────────────────

function VideoOverlay({ content, onClose }: { content: any; onClose: () => void }) {
  const videoUrl = content?.url || content?.youtube_url || "";
  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-30">
      <div className="relative w-full h-full max-w-[90%] max-h-[90%]">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white text-black rounded-full p-1 shadow-lg z-10"
        >
          <X size={16} />
        </button>
        {isYouTube ? (
          <iframe
            src={videoUrl.replace("watch?v=", "embed/")}
            className="w-full h-full rounded-lg"
            allowFullScreen
          />
        ) : (
          <video
            src={videoUrl}
            controls
            className="w-full h-full rounded-lg"
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
      </div>
    </div>
  );
}

function AudioOverlay({ content }: { content: any }) {
  const audioUrl = content?.url || "";
  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-md">
      <Volume2 size={20} className="text-primary" />
      <audio controls src={audioUrl} className="h-8 w-full max-w-[200px]" />
    </div>
  );
}

function QuizOverlay({ content }: { content: any }) {
  const questions = content?.questions || [];
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!questions.length) return null;

  const q = questions[current];
  const handleAnswer = (idx: number) => {
    setSelected(idx);
    if (idx === q.correctIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-xl p-4 shadow-xl w-80 max-w-full">
      {finished ? (
        <div className="text-center space-y-2">
          <p className="text-lg font-bold">النتيجة</p>
          <p className="text-2xl font-bold text-primary">
            {score} / {questions.length}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold text-right">{q.questionAr || q.question}</p>
          <div className="space-y-1">
            {q.options.map((opt: string, idx: number) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={selected !== null}
                className={`w-full text-right px-3 py-2 rounded-lg text-sm transition ${
                  selected === idx
                    ? idx === q.correctIndex
                      ? "bg-green-100 border border-green-500"
                      : "bg-red-100 border border-red-500"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {selected !== null && (
            <Button onClick={next} size="sm" className="w-full">
              {current < questions.length - 1 ? "التالي" : "إنهاء"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GameOverlay({ content }: { content: any }) {
  const iframeSrc = content?.url || content?.iframeSrc;
  if (!iframeSrc) return null;
  return (
    <div className="w-full h-full">
      <iframe src={iframeSrc} className="w-full h-full rounded-lg" sandbox="allow-scripts allow-same-origin" />
    </div>
  );
}

// ── المكون الرئيسي ─────────────────────────────────
export function PageOverlay({ items, pageWidth = 400, pageHeight = 550, role }: Props) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <>
      {items.map((item) => {
        // تحويل النسب المئوية إلى px
        const left = (item.position.x / 100) * pageWidth;
        const top = (item.position.y / 100) * pageHeight;
        const width = (item.position.width / 100) * pageWidth;
        const height = (item.position.height / 100) * pageHeight;

        return (
          <div
            key={item.id}
            className="absolute z-20"
            style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
          >
            {item.type === "video" ? (
              <button
                onClick={() => setActiveVideo(item.id)}
                className="w-full h-full flex items-center justify-center bg-black/30 hover:bg-black/50 rounded-lg transition group"
              >
                <Play size={32} className="text-white opacity-80 group-hover:opacity-100" />
              </button>
            ) : item.type === "audio" ? (
              <AudioOverlay content={item.content} />
            ) : item.type === "quiz" ? (
              <QuizOverlay content={item.content} />
            ) : item.type === "game" ? (
              <GameOverlay content={item.content} />
            ) : null}
          </div>
        );
      })}

      {/* عرض الفيديو النشط في وضع ملء الشاشة (Modal) */}
      {activeVideo && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
          <VideoOverlay
            content={items.find((i) => i.id === activeVideo)?.content}
            onClose={() => setActiveVideo(null)}
          />
        </div>
      )}
    </>
  );
}