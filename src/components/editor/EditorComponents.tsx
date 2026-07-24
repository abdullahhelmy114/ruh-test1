"use client";

import React, { useState, useRef } from "react";
import { 
  Play, Pause, Wand2, Loader2, Sparkles, CheckSquare, 
  X, FileText, Languages, Book, Download, Printer
} from "lucide-react";
import { T } from "@/components/TranslatedText";
import { AudioBlockData, QuizBlockData, ActiveTool } from "./types";

// ==========================================
// 1. Audio Block
// ==========================================
export const AudioBlock = ({ block, onUpdate, onDelete }: { block: AudioBlockData, onUpdate: any, onDelete: any }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (block.audioUrl && audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } 
      else { audioRef.current.play(); setIsPlaying(true); }
    }
  };

  const handleGenerateAiVoice = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: block.textToRead || "Preview", voiceId: "21m00Tcm4TlvDq8ikWAM" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        onUpdate({ ...block, audioUrl });
      }
    } catch (err) {} finally { setIsGenerating(false); }
  };

  return (
    <div className="my-8 rounded-2xl border border-border bg-secondary/30 p-5 transition-all hover:bg-secondary/50 shadow-sm relative group">
      {block.audioUrl && <audio ref={audioRef} src={block.audioUrl} onEnded={() => setIsPlaying(false)} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={togglePlay} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:scale-105">
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-primary uppercase">
              <Wand2 size={12} className="animate-pulse" /> <T>AI Generated Reading</T>
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">{block.title}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!block.audioUrl && (
            <button onClick={handleGenerateAiVoice} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} <T>Generate Audio</T>
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><X size={16} /></button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. Quiz Block
// ==========================================
export const QuizBlock = ({ block, onDelete }: { block: QuizBlockData, onDelete: any }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const currentQ = block.questions[activeIdx];

  if (!currentQ) return null;

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm group">
      <div className="flex items-center justify-between bg-secondary/40 px-5 py-3 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-2"><div className="rounded bg-primary p-1 text-primary-foreground"><CheckSquare size={13} /></div> <T>Interactive Quiz</T></div>
        <div className="flex items-center gap-3">
          <span><T>Question</T> {activeIdx + 1}/{block.questions.length}</span>
          <button onClick={onDelete} className="text-destructive hover:underline"><T>Delete</T></button>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">{currentQ.question}</h3>
        <div className="space-y-3">
          {currentQ.options.map((opt, i) => (
            <button key={i} onClick={() => setSelectedOpt(i)} className={`flex w-full items-center gap-4 rounded-xl border p-3.5 text-left transition-all ${selectedOpt === i ? (i === currentQ.correctIndex ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-destructive bg-destructive/10') : 'border-border bg-background hover:border-primary/50'}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selectedOpt === i ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>{opt.label || String.fromCharCode(65 + i)}</div>
              <span className="font-medium text-sm text-foreground">{opt.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. AI Tools Modal
// ==========================================
export const AiToolsModal = ({ activeTool, onClose, lessonText, onApply }: { activeTool: ActiveTool, onClose: any, lessonText: string, onApply: any }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!activeTool) return null;

  const handleRunTool = async () => {
    setLoading(true);
    try {
      let prompt = "";
      if (activeTool === "summary") prompt = `Summarize this and give key takeaways: ${lessonText}`;
      if (activeTool === "translate") prompt = `Translate to Professional Arabic: ${lessonText}`;
      if (activeTool === "ai-writer") prompt = `Expand this text with examples and fix grammar: ${lessonText}`;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type: "text" }),
      });
      const data = await res.json();
      setResult(data.text);
    } catch (err) { setResult("Error generating content."); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-5 top-5 p-2 text-muted-foreground hover:bg-secondary rounded-full"><X size={18} /></button>
        <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={20} /></div>
          <div><h2 className="text-xl font-bold text-foreground"><T>AI Assistant</T></h2></div>
        </div>
        {!result ? (
          <div className="text-center py-6">
            <button onClick={handleRunTool} disabled={loading} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg hover:bg-primary/90 flex items-center gap-2 mx-auto disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} <T>Start Generating</T>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-border bg-secondary/30 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">{result}</div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button onClick={() => { onApply(result); onClose(); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs"><T>Insert into Editor</T></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4. Library & Full Lesson Generator Modal
// ==========================================
export const LibraryModal = ({ isOpen, onClose, onGenerateLesson }: { isOpen: boolean, onClose: any, onGenerateLesson: any }) => {
  if (!isOpen) return null;

  const templates = [
    { id: "physics", title: "Quantum Optics: Wave-Particle Duality", subject: "PHYSICS", grade: "GRADE 11", desc: "Analyzing Young's double-slit experiment." },
    { id: "arabic", title: "المتنبي: دراسة بلاغية في معلقة الخيل والليل", subject: "LITERATURE", grade: "GRADE 10", desc: "دراسة تحليلية للصور الفنية والبلاغية." },
    { id: "biology", title: "The Wonders of Photosynthesis", subject: "BIOLOGY", grade: "GRADE 9", desc: "A gentle introduction to how plants turn sunlight into life." },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Book size={20} /></div>
            <div>
              <h2 className="text-xl font-bold text-foreground"><T>Lesson Scripts Workspace</T></h2>
              <p className="text-xs text-muted-foreground"><T>Notion x Apple Pages Editor</T></p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground"><T>Quick Templates & Books</T></h3>
          {templates.map((tpl) => (
            <div key={tpl.id} className="p-4 rounded-2xl border border-border bg-background hover:border-primary/50 transition-all flex items-center justify-between group">
              <div>
                <h4 className="font-bold text-foreground">{tpl.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{tpl.desc}</p>
                <div className="text-[10px] font-bold text-primary uppercase mt-2">{tpl.grade} • {tpl.subject}</div>
              </div>
              <button 
                onClick={() => { onGenerateLesson(tpl); onClose(); }}
                className="px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-xs opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground flex items-center gap-1"
              >
                <Sparkles size={14}/> <T>Generate Lesson</T>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};