"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import * as pdfjsLib from "pdfjs-dist";

import {
  Save, Loader2, Bold, Italic, Highlighter, Mic, Wand2, FileText, Languages, Sparkles,
  Trash2, Underline as UnderlineIcon, Palette, Image as ImageIcon, Link2, List, ListOrdered,
  Library, PenTool, BrainCircuit, Blocks, ArrowRight, X, Plus, Video, FileUp, FileDigit
} from "lucide-react";
import { LessonScript, ActiveTool } from "@/components/editor/types";
import { AudioBlock, QuizBlock, AiToolsModal, LibraryModal } from "@/components/editor/EditorComponents";

// حماية Worker الخاص بـ PDF.js
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

type TabCategory = "format" | "ai" | "insert";

// ==========================================
// 🚀 AI Curriculum Generator Modal
// ==========================================
const CurriculumModal = ({ isOpen, onClose, courseId, fetchLessons }: { isOpen: boolean, onClose: () => void, courseId: string, fetchLessons: () => void }) => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [level, setLevel] = useState("A1");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!selectedFile) return toast.error("يرجى اختيار ملف PDF");
    setLoading(true);
    const toastId = toast.loading("جاري تحليل الكتاب وبدء توليد المنهج...");

    try {
      const token = await user?.getIdToken();
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("level", level);
      formData.append("instructions", instructions);

      const startRes = await fetch("https://ai.ruhulqudus.net/generate-from-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const startData = await startRes.json();
      if (!startData.success) throw new Error(startData.detail || "فشل بدء المهمة");
      const taskId = startData.task_id;

      toast.loading("جاري توليد المنهج...", { id: toastId });
      const pollInterval = 5000;
      const maxAttempts = 60;
      let attempts = 0;
      let finalResult = null;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, pollInterval));
        const statusRes = await fetch(`https://ai.ruhulqudus.net/task-status/${taskId}`);
        const statusData = await statusRes.json();
        if (statusData.status === "completed") {
          finalResult = statusData.result;
          break;
        } else if (statusData.status === "failed") {
          throw new Error(statusData.result?.detail || "فشل المعالجة");
        }
        attempts++;
      }
      if (!finalResult) throw new Error("انتهت مهلة الانتظار");

      const lessonTitles: string[] = finalResult.titles;
      for (const title of lessonTitles) {
        await fetch(`/api/admin/courses/${courseId}/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: title,
            content: JSON.stringify({ html: "", audio: [], quiz: [] })
          }),
        });
      }

      toast.success(`تم إنشاء ${lessonTitles.length} درساً`, { id: toastId });
      fetchLessons();
      onClose();
    } catch (e: any) {
      toast.error("فشل التوليد: " + e.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border border-gray-200 rounded-3xl p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-6 top-6 p-2 text-gray-500 hover:bg-emerald-100 rounded-full transition-colors"><X size={18} /></button>
        <h2 className="text-2xl font-bold font-serif mb-2 flex items-center gap-2"><BrainCircuit className="text-primary"/> <T>AI Full Curriculum Generator</T></h2>
        <p className="text-gray-500 text-sm mb-6"><T>Upload a PDF book to generate a full curriculum.</T></p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2"><T>Upload PDF File</T></label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
              className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-primary hover:file:bg-emerald-500/20 file:cursor-pointer text-gray-500"
            />
            {selectedFile && <p className="text-xs text-green-600 mt-1">📄 {selectedFile.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-bold mb-2"><T>Target Level</T></label>
            <select className="w-full bg-background border border-gray-200 p-3 rounded-xl outline-none focus:border-primary" onChange={e => setLevel(e.target.value)} value={level}>
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2"><T>Additional AI Instructions</T></label>
            <textarea
              rows={3} onChange={e => setInstructions(e.target.value)}
              placeholder="e.g., Focus on grammar and Quranic vocabulary..."
              className="w-full bg-background border border-gray-200 p-3 rounded-xl outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
          <button onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 hover:bg-emerald-100 text-sm font-semibold transition-colors"><T>Cancel</T></button>
          <button onClick={handleGenerate} disabled={loading || !selectedFile} className="px-6 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} <T>Build Curriculum</T>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🚀 Main Editor Component
// ==========================================
export default function SmartLessonEditor() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [view, setView] = useState<"list" | "editor">("list");
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabCategory>("format");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [videoModal, setVideoModal] = useState<{ src: string; title?: string } | null>(null);

  const [script, setScript] = useState<LessonScript>({
    id: "new", title: "", subtitle: "", grade: "GRADE 10", subject: "GENERAL", status: "DRAFT",
    fontFamily: "sans", fontSize: 18, contentHtml: "", audioBlocks: [], quizBlocks: []
  });

  const editor = useEditor({
    extensions: [
      StarterKit, TextStyle, Color, Underline, Link,
      Highlight.configure({ multicolor: true }),
      ImageExtension,
    ],
    content: "",
    editorProps: { attributes: { class: "prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-gray-900 leading-loose" } },
    onUpdate: ({ editor }) => setScript(prev => ({ ...prev, contentHtml: editor.getHTML() }))
  });

  const fetchLessons = () => {
    if (!user || !courseId) return;
    user.getIdToken().then((token) => {
      fetch(`/api/admin/courses/${courseId}/lessons`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => { setLessons(data.lessons || []); setLoading(false); })
        .catch(() => { toast.error("Failed to fetch lessons"); setLoading(false); });
    });
  };

  useEffect(() => { fetchLessons(); }, [user, courseId]);

  const openEditor = (lesson: any = null) => {
    if (lesson) {
      let audio = [], quiz = [];
      let html = lesson.content || "";
      try {
        const parsed = JSON.parse(lesson.content);
        html = parsed.html || "";
        audio = parsed.audio || [];
        quiz = parsed.quiz || [];
      } catch (e) {}

      setScript({
        id: lesson.id, title: lesson.title, subtitle: "", grade: "GRADE 10", subject: "GENERAL", status: "DRAFT",
        fontFamily: "sans", fontSize: 18, contentHtml: html, audioBlocks: audio, quizBlocks: quiz
      });
      editor?.commands.setContent(html);
    } else {
      setScript({
        id: "new", title: "", subtitle: "", grade: "GRADE 10", subject: "GENERAL", status: "DRAFT",
        fontFamily: "sans", fontSize: 18, contentHtml: "", audioBlocks: [], quizBlocks: []
      });
      editor?.commands.setContent("");
    }
    setView("editor");
  };

  const handleSave = async () => {
    if (!script.title.trim()) return toast.error("Please enter a lesson title");
    setSaving(true);
    try {
      const token = await user?.getIdToken();
      const isNew = script.id === "new";
      const url = isNew
        ? `/api/admin/courses/${courseId}/lessons`
        : `/api/admin/courses/${courseId}/lessons/${script.id}`;

      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: script.title,
          content: JSON.stringify({ html: script.contentHtml, audio: script.audioBlocks, quiz: script.quizBlocks }),
        }),
      });
      if (res.ok) {
        toast.success("Lesson saved successfully");
        fetchLessons();
        setView("list");
      }
    } catch (e) { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm("Are you sure you want to delete this lesson?")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Lesson deleted"); fetchLessons(); }
    } catch (error) { toast.error("Failed to delete"); }
  };

  const addAiQuiz = async () => {
    setAiLoading(true);
    const text = editor?.getText() || script.title;
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, type: "quiz" })
      });
      const data = await res.json();
      if (data.success) {
        const parsed = JSON.parse(data.text.replace(/```json/g, "").replace(/```/g, ""));
        setScript(prev => ({ ...prev, quizBlocks: [...prev.quizBlocks, { id: Date.now().toString(), title: "AI Interactive Quiz", currentQuestionIndex: 0, questions: parsed }] }));
        toast.success(<T>Quiz generated successfully</T> as unknown as string);
      }
    } catch (e) { toast.error(<T>Generation failed</T> as unknown as string); }
    setAiLoading(false);
  };

  const generateSingleLesson = async (book: any) => {
    const toastId = toast.loading(<T>Generating a comprehensive lesson from</T> as unknown as string + ` "${book.book_title}"...`);
    setAiLoading(true);
    try {
      const token = await user?.getIdToken();
      const prompt = `Write a comprehensive, highly detailed educational lesson in Arabic based ONLY on the book titled "${book.book_title}". Include a strong introduction, main educational concepts, and a clear conclusion. Format the response entirely in HTML so it looks beautiful in a rich text editor.`;

      const res = await fetch("/api/ai/generate", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, type: "text" })
      });
      const data = await res.json();
      if (data.success) {
        setScript(prev => ({ ...prev, title: `Lesson from: ${book.book_title}`, subtitle: "AI Generated Content" }));
        const cleanHtml = data.text.replace(/```html/g, "").replace(/```/g, "").trim();
        editor?.commands.setContent(cleanHtml);
        toast.success(<T>Lesson generated successfully!</T> as unknown as string, { id: toastId });
      } else throw new Error();
    } catch (err) { toast.error(<T>Failed to generate lesson</T> as unknown as string, { id: toastId }); }
    finally { setAiLoading(false); }
  };

  // دالة رفع الوسائط العامة (صوت، PDF تضمين، ملفات)
  const handleMediaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const fileType = file.type;
      let html = '';

      if (fileType.startsWith('audio/')) {
        html = `<audio controls src="${base64}" style="width:100%"></audio>`;
      } else if (fileType === 'application/pdf') {
        html = `<iframe src="${base64}" width="100%" height="600px" style="border:none"></iframe>`;
      } else {
        const sizeKB = (file.size / 1024).toFixed(1);
        html = `<div><a href="${base64}" download="${file.name}" class="text-primary underline">📎 ${file.name} (${sizeKB} KB)</a></div>`;
      }

      editor.chain().focus().insertContent(html).run();
      toast.success("تمت الإضافة");
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [editor]);

  // دالة استيراد PDF وتحويله إلى نصوص قابلة للتحرير
  const handlePdfToText = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += `<p>${pageText}</p>`;
        }
        editor.chain().focus().insertContent(fullText).run();
        toast.success("تم استيراد النص من PDF");
      } catch (err) {
        toast.error("فشل استيراد PDF");
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }, [editor]);

  // دالة رفع فيديو من الجهاز
  const handleVideoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const html = `
        <div class="video-wrapper" style="position:relative; margin:1rem 0;">
          <video controls src="${src}" style="width:100%; max-width:100%;" ondblclick="event.preventDefault(); this.requestFullscreen();"></video>
        </div>
      `;
      editor.chain().focus().insertContent(html).run();
      toast.success("تمت إضافة الفيديو. انقر مرتين لملء الشاشة.");
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [editor]);

  // إضافة يوتيوب
  const addYouTube = () => {
    const url = prompt("YouTube URL:");
    if (url) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;
      if (videoId) {
        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        const html = `<div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin:1rem 0;"><iframe src="${embedUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%;" allowfullscreen></iframe></div>`;
        editor?.chain().focus().insertContent(html).run();
      }
    }
  };

  // عرض الفيديو في مودال
  const openVideoModal = (src: string) => setVideoModal({ src });
  useEffect(() => {
    if (!editor) return;
    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'VIDEO') {
        const src = target.getAttribute('src');
        if (src) openVideoModal(src);
      }
    };
    editor.view.dom.addEventListener('dblclick', handleDblClick);
    return () => editor.view.dom.removeEventListener('dblclick', handleDblClick);
  }, [editor]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  return (
    <div className="min-h-screen bg-background text-gray-900 selection:bg-emerald-500/20 selection:text-primary flex">

      {view === "editor" && (
        <aside className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 p-3 bg-card/90 backdrop-blur-xl border border-gray-200 rounded-3xl shadow-2xl z-50">
          <button onClick={() => setActiveTab("format")} className={`p-3 rounded-2xl transition-all ${activeTab === "format" ? "bg-emerald-600 text-white shadow-md" : "text-gray-500 hover:bg-emerald-100 hover:text-gray-900"}`} title="Formatting">
            <PenTool size={22} />
          </button>
          <button onClick={() => setActiveTab("ai")} className={`p-3 rounded-2xl transition-all ${activeTab === "ai" ? "bg-emerald-600 text-white shadow-md" : "text-gray-500 hover:bg-emerald-100 hover:text-gray-900"}`} title="AI Tools">
            <BrainCircuit size={22} />
          </button>
          <button onClick={() => setActiveTab("insert")} className={`p-3 rounded-2xl transition-all ${activeTab === "insert" ? "bg-emerald-600 text-white shadow-md" : "text-gray-500 hover:bg-emerald-100 hover:text-gray-900"}`} title="Insert Media & Files">
            <Blocks size={22} />
          </button>
          <div className="w-8 h-px bg-border mx-auto my-1" />
          <button onClick={() => setIsLibraryOpen(true)} className="p-3 rounded-2xl text-amber-700 bg-accent/10 hover:bg-accent/20 transition-all" title="Library & Models">
            <Library size={22} />
          </button>
        </aside>
      )}

      <main className={`flex-1 relative ${view === "editor" ? "ml-24" : ""}`}>

        {view === "list" && (
          <article className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
            <button onClick={() => router.push("/dashboard/admin")} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium mb-8">
              <ArrowRight size={18} className="rotate-180" /> <T>Back to Dashboard</T>
            </button>

            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
              <div>
                <h1 className="text-3xl font-serif font-bold text-gray-900"><T>Lesson & Script Management</T></h1>
                <p className="text-gray-500 mt-2"><T>Build the curriculum and arrange lessons for the course.</T></p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setIsCurriculumOpen(true)} className="flex items-center gap-2 rounded-full bg-accent/20 text-amber-700 px-6 py-3 font-bold hover:bg-accent/30 transition-all shadow-sm">
                  <BrainCircuit size={18} /> <T>Generate AI Curriculum</T>
                </button>
                <button onClick={() => openEditor()} className="flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 shadow-elegant transition-all">
                  <Plus size={18} /> <T>Add Manual Lesson</T>
                </button>
              </div>
            </header>

            <section className="grid gap-4">
              {lessons.map((lesson, idx) => (
                <div key={lesson.id} className="group flex items-center justify-between glass p-5 rounded-2xl border border-gray-200 hover:border-primary/50 transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-lg">{idx + 1}</div>
                    <h2 className="text-lg font-bold text-gray-900">{lesson.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => handleDelete(lesson.id, e)} className="p-2.5 rounded-full text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                    <button onClick={() => openEditor(lesson)} className="flex items-center gap-2 text-sm font-semibold text-amber-700 bg-accent/10 px-5 py-2.5 rounded-full hover:bg-accent/20 transition-all"><PenTool size={16} /> <T>Edit Script</T></button>
                  </div>
                </div>
              ))}
              {lessons.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-gray-200/60 rounded-3xl bg-emerald-100/10">
                  <div className="h-16 w-16 bg-emerald-100 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-4"><BrainCircuit size={24} /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900"><T>No lessons yet</T></h3>
                  <p className="text-gray-500 max-w-sm mx-auto leading-relaxed"><T>Start by generating a full AI curriculum from a book, or create your first lesson manually.</T></p>
                </div>
              )}
            </section>
          </article>
        )}

        {view === "editor" && (
          <section className="relative min-h-screen bg-muted/20 animate-in zoom-in-95 duration-300">

            <nav className="sticky top-4 mx-auto max-w-4xl z-40 flex items-center justify-between bg-card/95 backdrop-blur-2xl border border-gray-200 px-5 py-2.5 rounded-full shadow-xl transition-all duration-300">
              <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
                <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded-lg ${editor?.isActive('bold') ? 'bg-emerald-500/20 text-primary' : 'hover:bg-emerald-100'}`}><Bold size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg ${editor?.isActive('italic') ? 'bg-emerald-500/20 text-primary' : 'hover:bg-emerald-100'}`}><Italic size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg ${editor?.isActive('underline') ? 'bg-emerald-500/20 text-primary' : 'hover:bg-emerald-100'}`}><UnderlineIcon size={16} /></button>
                <div className="w-px h-5 bg-border mx-2" />
                <button onClick={() => editor?.chain().focus().toggleHighlight().run()} className="p-2 rounded-lg hover:bg-emerald-100 text-amber-700" title="Highlight"><Highlighter size={16} /></button>
                <button onClick={() => editor?.chain().focus().setColor('#2563EB').run()} className="p-2 rounded-lg hover:bg-emerald-100 text-blue-600" title="Text Color"><Palette size={16} /></button>
              </div>

              {activeTab === "ai" && (
                <div className="flex items-center gap-2 animate-in fade-in px-2">
                  <button onClick={() => setScript(p => ({...p, audioBlocks: [...p.audioBlocks, { id: Date.now().toString(), title: "Voice Recording", waveformHeights: [2,4,6,8,5], textToRead: editor?.getText() }]}))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-primary hover:bg-emerald-500/20 transition text-xs font-bold"><Mic size={14} /> <T>AI Voice</T></button>
                  <button onClick={addAiQuiz} disabled={aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/20 text-amber-700 hover:bg-accent/30 transition text-xs font-bold"><Wand2 size={14} /> <T>Interactive Quiz</T></button>
                  <button onClick={() => setActiveTool("summary")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition text-xs font-bold"><FileText size={14} /> <T>Summarize</T></button>
                  <button onClick={() => setActiveTool("ai-writer")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition text-xs font-bold"><Sparkles size={14} /> <T>Expand & Rewrite</T></button>
                  <button onClick={() => setActiveTool("translate")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition text-xs font-bold"><Languages size={14} /> <T>Translate</T></button>
                </div>
              )}

              {activeTab === "insert" && (
                <div className="flex items-center gap-1 animate-in fade-in px-2">
                  <button onClick={() => { const url = prompt('URL:'); if(url) editor?.chain().focus().setLink({ href: url }).run(); }} className="p-2 rounded-lg hover:bg-emerald-100"><Link2 size={16} /></button>
                  <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="p-2 rounded-lg hover:bg-emerald-100"><List size={16} /></button>
                  <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="p-2 rounded-lg hover:bg-emerald-100"><ListOrdered size={16} /></button>
                  <button onClick={() => { const url = prompt('Image URL:'); if(url) editor?.chain().focus().setImage({ src: url }).run(); }} className="p-2 rounded-lg hover:bg-emerald-100"><ImageIcon size={16} /></button>
                  <div className="w-px h-5 bg-border mx-1" />
                  <button onClick={addYouTube} className="p-2 rounded-lg hover:bg-emerald-100" title="YouTube"><Video size={16} /></button>
                  <label className="p-2 rounded-lg hover:bg-emerald-100 cursor-pointer" title="Import PDF as text">
                    <FileDigit size={16} />
                    <input type="file" accept=".pdf" onChange={handlePdfToText} className="hidden" />
                  </label>
                  <label className="p-2 rounded-lg hover:bg-emerald-100 cursor-pointer" title="Upload Video">
                    <FileUp size={16} />
                    <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  </label>
                  <label className="p-2 rounded-lg hover:bg-emerald-100 cursor-pointer" title="Upload Audio, PDF or File">
                    <FileUp size={16} />
                    <input type="file" accept="audio/*,application/pdf,.doc,.docx,.ppt,.pptx,.zip" onChange={handleMediaUpload} className="hidden" />
                  </label>
                </div>
              )}

              <div className="flex items-center border-l border-gray-200 pl-4">
                <button onClick={() => setView("list")} className="p-2.5 rounded-full hover:bg-destructive/10 text-destructive transition-colors mr-1"><X size={20} /></button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-md disabled:opacity-50 text-sm">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <T>Save</T>
                </button>
              </div>
            </nav>

            <article className="pt-12 pb-32 px-4 flex justify-center">
              <div className="w-full max-w-4xl min-h-[800px] bg-card border border-gray-200 shadow-2xl rounded-3xl p-12 md:p-16 relative">
                <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
                  <span className="h-2 w-2 rounded-full bg-primary" /> <T>Lesson Draft</T>
                </div>

                <input
                  value={script.title} onChange={(e) => setScript({...script, title: e.target.value})}
                  placeholder="Lesson Title..."
                  className="w-full text-4xl font-serif font-bold text-gray-900 bg-transparent outline-none placeholder:text-gray-500/30 border-b border-transparent hover:border-gray-200 focus:border-primary pb-4 mb-6 transition"
                />

                <EditorContent editor={editor} className="min-h-[500px]" />

                {script.audioBlocks.length > 0 && (
                  <div className="mt-12 space-y-6">
                    {script.audioBlocks.map((b) => <AudioBlock key={b.id} block={b} onUpdate={() => {}} onDelete={() => setScript(p => ({...p, audioBlocks: p.audioBlocks.filter(x => x.id !== b.id)}))} />)}
                  </div>
                )}
                {script.quizBlocks.length > 0 && (
                  <div className="mt-12 space-y-6">
                    {script.quizBlocks.map((b) => <QuizBlock key={b.id} block={b} onDelete={() => setScript(p => ({...p, quizBlocks: p.quizBlocks.filter(x => x.id !== b.id)}))} />)}
                  </div>
                )}
              </div>
            </article>

            <AiToolsModal activeTool={activeTool} onClose={() => setActiveTool(null)} lessonText={editor?.getText() || script.title} onApply={(txt: string) => editor?.commands.insertContent(`<p>${txt}</p>`)} />
            <LibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onGenerateLesson={generateSingleLesson} />

            {videoModal && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVideoModal(null)}>
                <div className="relative w-full max-w-5xl" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setVideoModal(null)} className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 z-10"><X size={20} /></button>
                  <video src={videoModal.src} controls autoPlay className="w-full rounded-xl" />
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <CurriculumModal isOpen={isCurriculumOpen} onClose={() => setIsCurriculumOpen(false)} courseId={courseId} fetchLessons={fetchLessons} />
    </div>
  );
}