"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { 
  ArrowRight, Save, Loader2, Bold, Italic, Highlighter, 
  Mic, Wand2, FileText, Languages, Sparkles, Plus, Trash2, PenTool, X 
} from "lucide-react";
import { LessonScript, ActiveTool, AudioBlockData } from "@/components/editor/types"; 
import { AudioBlock, QuizBlock, AiToolsModal } from "@/components/editor/EditorComponents";

export default function SmartLessonEditor() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { user, isLoading: authLoading } = useAuth();
  
  const [view, setView] = useState<"list" | "editor">("list");
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [script, setScript] = useState<LessonScript>({
    id: "new", title: "", subtitle: "", grade: "GRADE 10", subject: "GENERAL", status: "DRAFT",
    fontFamily: "sans", fontSize: 18, contentHtml: "", audioBlocks: [], quizBlocks: []
  });
  
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, Highlight.configure({ multicolor: true })],
    content: "",
    editorProps: { attributes: { class: "prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[400px] text-foreground leading-loose" } },
    onUpdate: ({ editor }) => setScript(prev => ({ ...prev, contentHtml: editor.getHTML() }))
  });

  const fetchLessons = () => {
    if (!user || !courseId) return;
    user.getIdToken().then((token) => {
      fetch(`/api/admin/model-courses/${courseId}/lessons`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setLessons(data.lessons || []);
          setLoading(false);
        })
        .catch(() => {
          toast.error(<T>Failed to fetch lessons</T> as unknown as string);
          setLoading(false);
        });
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
    if (!script.title) return toast.error(<T>Please enter a title</T> as unknown as string);
    setSaving(true);
    try {
      const token = await user?.getIdToken();
      const isNew = script.id === "new";
      const url = isNew ? `/api/admin/model-courses/${courseId}/lessons` : `/api/admin/model-courses/${courseId}/lessons/${script.id}`;
      
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          title: script.title, 
          content: JSON.stringify({ html: script.contentHtml, audio: script.audioBlocks, quiz: script.quizBlocks })
        }),
      });
      if (res.ok) {
        toast.success(<T>Lesson saved successfully</T> as unknown as string);
        fetchLessons();
        setView("list");
      }
    } catch (e) { toast.error(<T>Failed to save</T> as unknown as string); }
    finally { setSaving(false); }
  };

  const handleDelete = async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm("Are you sure you want to delete this lesson?")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/model-courses/${courseId}/lessons/${lessonId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success(<T>Lesson deleted</T> as unknown as string); fetchLessons(); }
    } catch (error) { toast.error(<T>Failed to delete</T> as unknown as string); }
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
        setScript(prev => ({ ...prev, quizBlocks: [...prev.quizBlocks, { id: Date.now().toString(), title: "AI Generated Quiz", currentQuestionIndex: 0, questions: parsed }] }));
        toast.success(<T>Quiz generated successfully</T> as unknown as string);
      }
    } catch (e) { toast.error(<T>Generation failed</T> as unknown as string); }
    setAiLoading(false);
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      
      {/* ─── List View ─── */}
      {view === "list" && (
        <article className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
          <button onClick={() => router.push("/dashboard/admin")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium mb-8">
            <ArrowRight size={18} className="rotate-180" /> <T>Back to Dashboard</T>
          </button>

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground"><T>Lesson & Script Management</T></h1>
              <p className="text-muted-foreground mt-2"><T>Build the curriculum and arrange lessons for teachers.</T></p>
            </div>
            <button onClick={() => openEditor()} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 shadow-elegant transition-all">
              <Plus size={18} /> <T>Add New Lesson</T>
            </button>
          </header>

          <section className="grid gap-4">
            {lessons.map((lesson, idx) => (
              <div key={lesson.id} className="group flex items-center justify-between glass p-5 rounded-2xl border border-border hover:border-primary/50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-secondary flex items-center justify-center font-bold text-lg">{idx + 1}</div>
                  <h2 className="text-lg font-bold text-foreground">{lesson.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => handleDelete(lesson.id, e)} className="p-2.5 rounded-full text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                  <button onClick={() => openEditor(lesson)} className="flex items-center gap-2 text-sm font-semibold text-accent-foreground bg-accent/10 px-5 py-2.5 rounded-full hover:bg-accent/20 transition-all"><PenTool size={16} /> <T>Edit Script</T></button>
                </div>
              </div>
            ))}
          </section>
        </article>
      )}

      {/* ─── Editor View (Tiptap + Dynamic Island) ─── */}
      {view === "editor" && (
        <section className="relative min-h-screen bg-muted/20 animate-in zoom-in-95 duration-300">
          
          <nav className="sticky top-4 mx-auto max-w-4xl z-50 flex items-center justify-between bg-card/90 backdrop-blur-2xl border border-border px-5 py-2.5 rounded-full shadow-2xl">
            <div className="flex items-center gap-1 border-r border-border pr-4">
              <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded-lg ${editor?.isActive('bold') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Bold size={16} /></button>
              <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg ${editor?.isActive('italic') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Italic size={16} /></button>
              <button onClick={() => editor?.chain().focus().toggleHighlight().run()} className="p-2 rounded-lg hover:bg-secondary text-accent-foreground"><Highlighter size={16} /></button>
            </div>

            <div className="flex items-center gap-1 px-4">
              <div className="flex items-center rounded-full bg-primary/5 p-1 border border-primary/10 shadow-inner">
                <span className="text-[11px] font-bold px-3 text-primary flex items-center gap-1"><Sparkles size={12}/> <T>AI Tools</T></span>
                <button onClick={() => setScript(p => ({...p, audioBlocks: [...p.audioBlocks, { id: Date.now().toString(), title: "Voice Recording", waveformHeights: [2,4,6,8,5], textToRead: editor?.getText() }]}))} className="p-2 rounded-full hover:bg-primary/10 text-primary transition tooltip"><Mic size={14} /></button>
                <button onClick={addAiQuiz} disabled={aiLoading} className="p-2 rounded-full hover:bg-primary/10 text-primary transition tooltip"><Wand2 size={14} /></button>
                <button onClick={() => setActiveTool("summary")} className="p-2 rounded-full hover:bg-primary/10 text-primary transition tooltip"><FileText size={14} /></button>
                <button onClick={() => setActiveTool("translate")} className="p-2 rounded-full hover:bg-primary/10 text-primary transition tooltip"><Languages size={14} /></button>
              </div>
            </div>

            <div className="flex items-center border-l border-border pl-4">
              <button onClick={() => setView("list")} className="p-2.5 rounded-full hover:bg-destructive/10 text-destructive transition-colors mr-1"><X size={20} /></button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition shadow-md disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <T>Save & Publish</T>
              </button>
            </div>
          </nav>

          <article className="pt-12 pb-32 px-4 flex justify-center">
            <div className="w-full max-w-[850px] min-h-[1000px] bg-card border border-border shadow-lg rounded-2xl p-10 md:p-20 relative">
              
              <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" /> <T>Lesson Draft</T>
              </div>

              <input 
                value={script.title} onChange={(e) => setScript({...script, title: e.target.value})} 
                placeholder="Lesson Title..." 
                className="w-full text-4xl md:text-5xl font-serif font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 border-b border-transparent hover:border-border focus:border-primary pb-4 mb-4 transition"
              />

              <EditorContent editor={editor} />

              <div className="mt-12 space-y-6">
                {script.audioBlocks.map((b) => <AudioBlock key={b.id} block={b} onUpdate={(updated: AudioBlockData) => setScript(p => ({...p, audioBlocks: p.audioBlocks.map(x => x.id === updated.id ? updated : x)}))} onDelete={() => setScript(p => ({...p, audioBlocks: p.audioBlocks.filter(x => x.id !== b.id)}))} />)}
                {script.quizBlocks.map((b) => <QuizBlock key={b.id} block={b} onGenerateAIQuiz={addAiQuiz} onDelete={() => setScript(p => ({...p, quizBlocks: p.quizBlocks.filter(x => x.id !== b.id)}))} />)}
              </div>

            </div>
          </article>

          <AiToolsModal 
            activeTool={activeTool} onClose={() => setActiveTool(null)} 
            lessonText={editor?.getText() || script.title} 
            onApply={(txt: string) => editor?.commands.insertContent(`<p>${txt}</p>`)} 
          />
        </section>
      )}
    </div>
  );
}