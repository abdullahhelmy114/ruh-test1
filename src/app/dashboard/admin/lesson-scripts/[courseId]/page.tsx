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
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import { 
  Save, Loader2, Bold, Italic, Highlighter, Mic, Wand2, FileText, Languages, Sparkles, 
  Trash2, Underline as UnderlineIcon, Palette, Image as ImageIcon, Link2, List, ListOrdered, 
  Library, Download, Printer, PenTool, BrainCircuit, Blocks
} from "lucide-react";
import { LessonScript, ActiveTool, AudioBlockData, QuizBlockData } from "@/components/editor/types";
import { AudioBlock, QuizBlock, AiToolsModal, LibraryModal } from "@/components/editor/EditorComponents";

type TabCategory = "format" | "ai" | "insert";

export default function SmartLessonEditor() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { user, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabCategory>("format");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);

  const [script, setScript] = useState<LessonScript>({
    id: "new", title: "", subtitle: "", grade: "GRADE 10", subject: "GENERAL", status: "DRAFT",
    fontFamily: "sans", fontSize: 18, contentHtml: "", audioBlocks: [], quizBlocks: []
  });

  const editor = useEditor({
    extensions: [
      StarterKit, 
      TextStyle, 
      Color, 
      Underline, 
      Link, 
      Highlight.configure({ multicolor: true }),
      ImageExtension // <--- قمنا بإضافة هذه الكلمة هنا
    ],
    content: "",
    editorProps: { attributes: { class: "prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-foreground leading-loose" } },
    onUpdate: ({ editor }) => setScript(prev => ({ ...prev, contentHtml: editor.getHTML() }))
  });

  // --- Functions ---
  const handleSave = async () => {
    if (!script.title.trim()) return toast.error(<T>Please enter a lesson title</T> as unknown as string);
    setSaving(true);
    setTimeout(() => { toast.success(<T>Lesson Saved Successfully!</T> as unknown as string); setSaving(false); }, 1000);
  };

  const addAiQuiz = async () => {
    setAiLoading(true);
    setTimeout(() => {
      setScript(prev => ({ ...prev, quizBlocks: [...prev.quizBlocks, { id: Date.now().toString(), title: "AI Interactive Quiz", currentQuestionIndex: 0, questions: [{ id: "q1", question: "AI Generated Question?", options: [{ id: "opt1", text: "Yes", label: "A"}, { id: "opt2", text: "No", label: "B"}], correctIndex: 0 }] }] }));
      toast.success(<T>Quiz generated!</T> as unknown as string);
      setAiLoading(false);
    }, 1500);
  };

const generateFullLesson = async (book: any) => {
    const toastId = toast.loading(<T>Generating a comprehensive lesson from</T> as unknown as string + ` "${book.book_title}"...`);
    setAiLoading(true);
    
    try {
      const token = await user?.getIdToken();
      // هنا نوجه الأمر للـ RAG System للبحث في هذا الكتاب حصراً وكتابة الدرس
      const prompt = `Write a comprehensive, highly detailed educational lesson in Arabic based ONLY on the book titled "${book.book_title}". Include a strong introduction, main educational concepts, and a clear conclusion. Format the response entirely in HTML so it looks beautiful in a rich text editor.`;

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt, type: "text" })
      });
      const data = await res.json();

      if (data.success) {
        // تحديث العنوان ليطابق الكتاب
        setScript(prev => ({ 
          ...prev, 
          title: `درس مستخرج من: ${book.book_title}`, 
          subtitle: "تم التوليد بواسطة الذكاء الاصطناعي" 
        }));
        
        // إزالة علامات الماركداون إذا أرجعها Gemini ووضع المحتوى في المحرر
        const cleanHtml = data.text.replace(/```html/g, "").replace(/```/g, "").trim();
        editor?.commands.setContent(cleanHtml);
        
        toast.success(<T>Lesson generated successfully!</T> as unknown as string, { id: toastId });
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error(<T>Failed to generate lesson from the book</T> as unknown as string, { id: toastId });
    } finally {
      setAiLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary flex">
      
      {/* ─── 🗂️ Sidebar (القسم الجانبي الأنيق) ─── */}
      <aside className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 p-3 bg-card/90 backdrop-blur-xl border border-border rounded-3xl shadow-2xl z-50">
        <button onClick={() => setActiveTab("format")} className={`p-3 rounded-2xl transition-all tooltip ${activeTab === "format" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="التنسيق (Formatting)">
          <PenTool size={22} />
        </button>
        <button onClick={() => setActiveTab("ai")} className={`p-3 rounded-2xl transition-all tooltip ${activeTab === "ai" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="الذكاء الاصطناعي (AI Tools)">
          <BrainCircuit size={22} />
        </button>
        <button onClick={() => setActiveTab("insert")} className={`p-3 rounded-2xl transition-all tooltip ${activeTab === "insert" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`} title="الأدوات والإدراج (Insert)">
          <Blocks size={22} />
        </button>
        <div className="w-8 h-px bg-border mx-auto my-1" />
        <button onClick={() => setIsLibraryOpen(true)} className="p-3 rounded-2xl text-accent-foreground bg-accent/10 hover:bg-accent/20 transition-all tooltip" title="مكتبة الكتب والنماذج">
          <Library size={22} />
        </button>
      </aside>

      {/* ─── 🖥️ Main Workspace ─── */}
      <main className="flex-1 ml-24 relative">
        
        {/* 🏝️ Dynamic Island (تتغير حسب التاب المختار) */}
        <nav className="sticky top-4 mx-auto max-w-3xl z-40 flex items-center justify-between bg-card/95 backdrop-blur-2xl border border-border px-5 py-2.5 rounded-full shadow-xl transition-all duration-300">
          
          {/* محتوى الجزيرة المتغير */}
          <div className="flex items-center gap-1">
            
            {activeTab === "format" && (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-4">
                <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded-lg ${editor?.isActive('bold') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Bold size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg ${editor?.isActive('italic') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Italic size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg ${editor?.isActive('underline') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><UnderlineIcon size={16} /></button>
                <div className="w-px h-5 bg-border mx-2" />
                <button onClick={() => editor?.chain().focus().toggleHighlight().run()} className="p-2 rounded-lg hover:bg-secondary text-accent-foreground" title="Highlight"><Highlighter size={16} /></button>
                <button onClick={() => editor?.chain().focus().setColor('#2563EB').run()} className="p-2 rounded-lg hover:bg-secondary text-blue-600" title="Text Color"><Palette size={16} /></button>
              </div>
            )}

            {activeTab === "ai" && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 px-2">
                <button onClick={() => setScript(p => ({...p, audioBlocks: [...p.audioBlocks, { id: Date.now().toString(), title: "Voice Recording", waveformHeights: [2,4,6,8,5], textToRead: editor?.getText() }]}))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition text-xs font-bold"><Mic size={14} /> <T>صوت AI</T></button>
                <button onClick={addAiQuiz} disabled={aiLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/20 text-accent-foreground hover:bg-accent/30 transition text-xs font-bold"><Wand2 size={14} /> <T>أسئلة تفاعلية</T></button>
                <button onClick={() => setActiveTool("summary")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition text-xs font-bold"><FileText size={14} /> <T>تلخيص</T></button>
                <button onClick={() => setActiveTool("ai-writer")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition text-xs font-bold"><Sparkles size={14} /> <T>صياغة وتوسيع</T></button>
                <button onClick={() => setActiveTool("translate")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition text-xs font-bold"><Languages size={14} /> <T>ترجمة</T></button>
              </div>
            )}

            {activeTab === "insert" && (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-4 px-2">
                <button onClick={() => { const url = prompt('URL:'); if(url) editor?.chain().focus().setLink({ href: url }).run(); }} className="p-2 rounded-lg hover:bg-secondary"><Link2 size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="p-2 rounded-lg hover:bg-secondary"><List size={16} /></button>
                <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="p-2 rounded-lg hover:bg-secondary"><ListOrdered size={16} /></button>
                <button onClick={() => { const url = prompt('Image URL:'); if(url) editor?.chain().focus().setImage({ src: url }).run(); }} className="p-2 rounded-lg hover:bg-secondary"><ImageIcon size={16} /></button>
              </div>
            )}

          </div>

          {/* الأزرار العالمية الثابتة (حفظ، طباعة، تصدير) */}
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <button onClick={() => window.print()} className="p-2 rounded-full hover:bg-secondary text-muted-foreground transition" title="Print/PDF"><Printer size={16} /></button>
            <button className="p-2 rounded-full hover:bg-secondary text-muted-foreground transition" title="Export Markdown"><Download size={16} /></button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition shadow-md disabled:opacity-50 text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} <T>حفظ</T>
            </button>
          </div>
        </nav>

        {/* 📄 Canvas Digital Paper */}
        <article className="pt-12 pb-32 px-4 flex justify-center">
          <div className="w-full max-w-[850px] min-h-[1050px] bg-card border border-border shadow-2xl rounded-[2rem] p-12 md:p-20 relative">
            
            <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" /> <T>مسودة الدرس</T> · {script.grade} · {script.subject}
            </div>

            <input 
              value={script.title} onChange={(e) => setScript({...script, title: e.target.value})} 
              placeholder="Lesson Title..." 
              className="w-full text-4xl md:text-5xl font-serif font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 border-b border-transparent hover:border-border focus:border-primary pb-4 mb-4 transition"
            />

            <EditorContent editor={editor} />
            {script.contentHtml === "" && (
                <div className="pointer-events-none -mt-4 text-lg text-muted-foreground/40 absolute font-light">
                  <T>Start writing your script here or use the Library to generate a full lesson...</T>
                </div>
            )}

            <div className="mt-12 space-y-6">
              {script.audioBlocks.map((b) => <AudioBlock key={b.id} block={b} onUpdate={() => {}} onDelete={() => setScript(p => ({...p, audioBlocks: p.audioBlocks.filter(x => x.id !== b.id)}))} />)}
              {script.quizBlocks.map((b) => <QuizBlock key={b.id} block={b} onDelete={() => setScript(p => ({...p, quizBlocks: p.quizBlocks.filter(x => x.id !== b.id)}))} />)}
            </div>
          </div>
        </article>
      </main>

      <AiToolsModal activeTool={activeTool} onClose={() => setActiveTool(null)} lessonText={editor?.getText() || script.title} onApply={(txt: string) => editor?.commands.insertContent(`<p>${txt}</p>`)} />
      <LibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onGenerateLesson={generateFullLesson} />
    </div>
  );
}