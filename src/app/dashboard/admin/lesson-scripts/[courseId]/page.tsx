"use client";

import { useState, useEffect } from "react";
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
  Library, Download, Printer, PenTool, BrainCircuit, Blocks, ArrowRight, X, Plus
} from "lucide-react";
import { LessonScript, ActiveTool, AudioBlockData, QuizBlockData } from "@/components/editor/types";
import { AudioBlock, QuizBlock, AiToolsModal, LibraryModal } from "@/components/editor/EditorComponents";

// حماية Worker الخاص بـ PDF.js من الانهيار على السيرفر
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

type TabCategory = "format" | "ai" | "insert";

// ==========================================
// 🚀 AI Curriculum Generator Modal
// ==========================================
// ... (باقي الاستيرادات كما هي)

const CurriculumModal = ({ isOpen, onClose, courseId, fetchLessons }: { isOpen: boolean, onClose: () => void, courseId: string, fetchLessons: () => void }) => {
  const { user } = useAuth();
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [level, setLevel] = useState("A1");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      user.getIdToken().then(t => fetch("/api/admin/knowledge/books", { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.json()).then(d => setBooks(d.books || [])));
    }
  }, [isOpen, user]);

const handleGenerate = async () => {
    if (!selectedBook) return toast.error(<T>Please select a book first</T> as unknown as string);
    setLoading(true);
    const toastId = toast.loading(<T>AI agents are reading the book, planning, and creating full curriculum...</T> as unknown as string);

    try {
      const token = await user?.getIdToken();
      
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          bookTitle: selectedBook,
          level: level,
          instructions: instructions 
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.details || "Generation failed");

      const lessonTitles: string[] = data.titles;
      
      // إنشاء الدروس لكل عنوان
      for (const title of lessonTitles) {
        await fetch(`/api/admin/model-courses/${courseId}/lessons`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            title: title, 
            content: JSON.stringify({ html: "", audio: [], quiz: [] })
          }),
        });
      }

      // نجاح مع عرض عدد الدروس مع ترجمة آمنة
      const lessonsCount = lessonTitles.length;
      toast.success(
        <span><T>Curriculum generated successfully!</T> {lessonsCount} <T>lessons created.</T></span>, 
        { id: toastId }
      );
      fetchLessons();
      onClose();
    } catch (e: any) {
      toast.error(<T>Failed to generate.</T> as unknown as string, { id: toastId });
    } finally { 
      setLoading(false); 
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-6 top-6 p-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors"><X size={18} /></button>
        <h2 className="text-2xl font-bold font-serif mb-2 flex items-center gap-2"><BrainCircuit className="text-primary"/> <T>AI Full Curriculum Generator</T></h2>
        <p className="text-muted-foreground text-sm mb-6"><T>The AI agents will analyze the book, split it into 10 lessons, and create engaging titles.</T></p>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2 text-foreground"><T>Select Reference Book</T></label>
            <select 
              value={selectedBook}
              className="w-full bg-background text-foreground border border-border p-3 rounded-xl outline-none focus:border-primary cursor-pointer" 
              onChange={e => setSelectedBook(e.target.value)}
            >
              <option value="" disabled>-- <T>Select a book from Knowledge Base</T> --</option>
              {books.map((b, i) => (
                <option key={i} value={b.title}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2"><T>Target Level</T></label>
            <select className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary" onChange={e => setLevel(e.target.value)} value={level}>
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
              placeholder="e.g., Focus on grammar and Quranic vocabulary, make lessons interactive..."
              className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
          <button onClick={onClose} className="px-5 py-2 rounded-xl border border-border hover:bg-secondary text-sm font-semibold transition-colors"><T>Cancel</T></button>
          <button onClick={handleGenerate} disabled={loading || !selectedBook} className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50">
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
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false); // <-- حالة زر توليد المنهج
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  const [script, setScript] = useState<LessonScript>({
    id: "new", title: "", subtitle: "", grade: "GRADE 10", subject: "GENERAL", status: "DRAFT",
    fontFamily: "sans", fontSize: 18, contentHtml: "", audioBlocks: [], quizBlocks: []
  });

  const editor = useEditor({
    extensions: [
      StarterKit, TextStyle, Color, Underline, Link, 
      Highlight.configure({ multicolor: true }), ImageExtension
    ],
    content: "",
    editorProps: { attributes: { class: "prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-foreground leading-loose" } },
    onUpdate: ({ editor }) => setScript(prev => ({ ...prev, contentHtml: editor.getHTML() }))
  });

  const fetchLessons = () => {
    if (!user || !courseId) return;
    user.getIdToken().then((token) => {
      fetch(`/api/admin/model-courses/${courseId}/lessons`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => { setLessons(data.lessons || []); setLoading(false); })
        .catch(() => { toast.error(<T>Failed to fetch lessons</T> as unknown as string); setLoading(false); });
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
    if (!script.title.trim()) return toast.error(<T>Please enter a lesson title</T> as unknown as string);
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
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
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
        setScript(prev => ({ ...prev, quizBlocks: [...prev.quizBlocks, { id: Date.now().toString(), title: "AI Interactive Quiz", currentQuestionIndex: 0, questions: parsed }] }));
        toast.success(<T>Quiz generated successfully</T> as unknown as string);
      }
    } catch (e) { toast.error(<T>Generation failed</T> as unknown as string); }
    setAiLoading(false);
  };

  // دالة توليد درس واحد مفرد من المكتبة
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

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary flex">
      
      {/* ─── 🗂️ Sidebar ─── */}
      {view === "editor" && (
        <aside className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 p-3 bg-card/90 backdrop-blur-xl border border-border rounded-3xl shadow-2xl z-50">
          <button onClick={() => setActiveTab("format")} className={`p-3 rounded-2xl transition-all tooltip ${activeTab === "format" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="Formatting">
            <PenTool size={22} />
          </button>
          <button onClick={() => setActiveTab("ai")} className={`p-3 rounded-2xl transition-all tooltip ${activeTab === "ai" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="AI Tools">
            <BrainCircuit size={22} />
          </button>
          <button onClick={() => setActiveTab("insert")} className={`p-3 rounded-2xl transition-all tooltip ${activeTab === "insert" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="Insert Tools">
            <Blocks size={22} />
          </button>
          <div className="w-8 h-px bg-border mx-auto my-1" />
          <button onClick={() => setIsLibraryOpen(true)} className="p-3 rounded-2xl text-accent-foreground bg-accent/10 hover:bg-accent/20 transition-all tooltip" title="Library & Models">
            <Library size={22} />
          </button>
        </aside>
      )}

      <main className={`flex-1 relative ${view === "editor" ? "ml-24" : ""}`}>
        
        {/* ─── List View (Lessons Manager) ─── */}
        {view === "list" && (
          <article className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
            <button onClick={() => router.push("/dashboard/admin")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium mb-8">
              <ArrowRight size={18} className="rotate-180" /> <T>Back to Dashboard</T>
            </button>

            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
              <div>
                <h1 className="text-3xl font-serif font-bold text-foreground"><T>Lesson & Script Management</T></h1>
                <p className="text-muted-foreground mt-2"><T>Build the curriculum and arrange lessons for teachers.</T></p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setIsCurriculumOpen(true)} className="flex items-center gap-2 rounded-full bg-accent/20 text-accent-foreground px-6 py-3 font-bold hover:bg-accent/30 transition-all shadow-sm">
                  <BrainCircuit size={18} /> <T>Generate AI Curriculum</T>
                </button>
                <button onClick={() => openEditor()} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 shadow-elegant transition-all">
                  <Plus size={18} /> <T>Add Manual Lesson</T>
                </button>
              </div>
            </header>

            <section className="grid gap-4">
              {lessons.map((lesson, idx) => (
                <div key={lesson.id} className="group flex items-center justify-between glass p-5 rounded-2xl border border-border hover:border-primary/50 transition-all shadow-sm">
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
              {lessons.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-border/60 rounded-3xl bg-secondary/10">
                  <div className="h-16 w-16 bg-secondary text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4"><BrainCircuit size={24} /></div>
                  <h3 className="text-xl font-bold mb-2 text-foreground"><T>No lessons yet</T></h3>
                  <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed"><T>Start by generating a full AI curriculum from a book, or create your first lesson manually.</T></p>
                </div>
              )}
            </section>
          </article>
        )}

        {/* ─── Editor View (Tiptap + Dynamic Island) ─── */}
        {view === "editor" && (
          <section className="relative min-h-screen bg-muted/20 animate-in zoom-in-95 duration-300">
            
            <nav className="sticky top-4 mx-auto max-w-4xl z-40 flex items-center justify-between bg-card/95 backdrop-blur-2xl border border-border px-5 py-2.5 rounded-full shadow-xl transition-all duration-300">
              <div className="flex items-center gap-1 border-r border-border pr-4">
                <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded-lg ${editor?.isActive('bold') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Bold size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg ${editor?.isActive('italic') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Italic size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg ${editor?.isActive('underline') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><UnderlineIcon size={16} /></button>
                <div className="w-px h-5 bg-border mx-2" />
                <button onClick={() => editor?.chain().focus().toggleHighlight().run()} className="p-2 rounded-lg hover:bg-secondary text-accent-foreground" title="Highlight"><Highlighter size={16} /></button>
                <button onClick={() => editor?.chain().focus().setColor('#2563EB').run()} className="p-2 rounded-lg hover:bg-secondary text-blue-600" title="Text Color"><Palette size={16} /></button>
              </div>

              {activeTab === "ai" && (
                <div className="flex items-center gap-2 animate-in fade-in px-2">
                  <button onClick={() => setScript(p => ({...p, audioBlocks: [...p.audioBlocks, { id: Date.now().toString(), title: "Voice Recording", waveformHeights: [2,4,6,8,5], textToRead: editor?.getText() }]}))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition text-xs font-bold"><Mic size={14} /> <T>AI Voice</T></button>
                  <button onClick={addAiQuiz} disabled={aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/20 text-accent-foreground hover:bg-accent/30 transition text-xs font-bold"><Wand2 size={14} /> <T>Interactive Quiz</T></button>
                  <button onClick={() => setActiveTool("summary")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition text-xs font-bold"><FileText size={14} /> <T>Summarize</T></button>
                  <button onClick={() => setActiveTool("ai-writer")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition text-xs font-bold"><Sparkles size={14} /> <T>Expand & Rewrite</T></button>
                  <button onClick={() => setActiveTool("translate")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition text-xs font-bold"><Languages size={14} /> <T>Translate</T></button>
                </div>
              )}

              {activeTab === "insert" && (
                <div className="flex items-center gap-1 animate-in fade-in px-2">
                  <button onClick={() => { const url = prompt('URL:'); if(url) editor?.chain().focus().setLink({ href: url }).run(); }} className="p-2 rounded-lg hover:bg-secondary"><Link2 size={16} /></button>
                  <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="p-2 rounded-lg hover:bg-secondary"><List size={16} /></button>
                  <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="p-2 rounded-lg hover:bg-secondary"><ListOrdered size={16} /></button>
                  <button onClick={() => { const url = prompt('Image URL:'); if(url) editor?.chain().focus().setImage({ src: url }).run(); }} className="p-2 rounded-lg hover:bg-secondary"><ImageIcon size={16} /></button>
                </div>
              )}

              <div className="flex items-center border-l border-border pl-4">
                <button onClick={() => setView("list")} className="p-2.5 rounded-full hover:bg-destructive/10 text-destructive transition-colors mr-1"><X size={20} /></button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition shadow-md disabled:opacity-50 text-sm">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <T>Save</T>
                </button>
              </div>
            </nav>

            <article className="pt-12 pb-32 px-4 flex justify-center">
              <div className="w-full max-w-[850px] min-h-[1050px] bg-card border border-border shadow-2xl rounded-[2rem] p-12 md:p-20 relative">
                <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" /> <T>Lesson Draft</T>
                </div>

                <input 
                  value={script.title} onChange={(e) => setScript({...script, title: e.target.value})} 
                  placeholder="Lesson Title..." 
                  className="w-full text-4xl md:text-5xl font-serif font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 border-b border-transparent hover:border-border focus:border-primary pb-4 mb-4 transition"
                />

                <EditorContent editor={editor} />
                {script.contentHtml === "" && (
                    <div className="pointer-events-none -mt-4 text-lg text-muted-foreground/40 absolute font-light">
                      <T>Start writing your script here...</T>
                    </div>
                )}

                <div className="mt-12 space-y-6">
                  {script.audioBlocks.map((b) => <AudioBlock key={b.id} block={b} onUpdate={() => {}} onDelete={() => setScript(p => ({...p, audioBlocks: p.audioBlocks.filter(x => x.id !== b.id)}))} />)}
                  {script.quizBlocks.map((b) => <QuizBlock key={b.id} block={b} onDelete={() => setScript(p => ({...p, quizBlocks: p.quizBlocks.filter(x => x.id !== b.id)}))} />)}
                </div>
              </div>
            </article>
            
            <AiToolsModal activeTool={activeTool} onClose={() => setActiveTool(null)} lessonText={editor?.getText() || script.title} onApply={(txt: string) => editor?.commands.insertContent(`<p>${txt}</p>`)} />
            <LibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onGenerateLesson={generateSingleLesson} />
          </section>
        )}
      </main>

      <CurriculumModal isOpen={isCurriculumOpen} onClose={() => setIsCurriculumOpen(false)} courseId={courseId} fetchLessons={fetchLessons} />
    </div>
  );
}