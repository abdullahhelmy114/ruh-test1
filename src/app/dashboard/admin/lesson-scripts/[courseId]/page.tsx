"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style"; // تمت إضافة الأقواس {}
import { Color } from "@tiptap/extension-color";   
import ImageExtension from "@tiptap/extension-image";
import { 
  ArrowRight, Plus, PenTool, Type, Image as ImageIcon, 
  MonitorPlay, X, Save, Loader2, Trash2, Bold, Italic, 
  Underline as UnderlineIcon, Highlighter, Wand2, Mic, Play, CheckSquare
} from "lucide-react";

export default function LessonWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { user, isLoading: authLoading } = useAuth();
  
  const [view, setView] = useState<"list" | "editor">("list");
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [editorTitle, setEditorTitle] = useState("");
  
  // حفظ البلوكات الإضافية (مثل الصوت والأسئلة)
  const [audioBlocks, setAudioBlocks] = useState<any[]>([]);
  const [quizBlocks, setQuizBlocks] = useState<any[]>([]);

  // 1. إعداد محرك Tiptap
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ImageExtension,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[400px] text-foreground leading-loose",
      },
    },
  });

  // 2. جلب الدروس
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
          toast.error(<T>حدث خطأ أثناء جلب الدروس</T> as unknown as string);
          setLoading(false);
        });
    });
  };

  useEffect(() => { fetchLessons(); }, [user, courseId]);

  // 3. فتح المحرر وتوزيع البيانات
  const openEditor = (lesson: any = null) => {
    setSelectedLesson(lesson);
    setEditorTitle(lesson ? lesson.title : "");
    
    // نقوم بفك تشفير الـ JSON إذا كان موجوداً
    if (lesson && lesson.content) {
      try {
        const parsed = JSON.parse(lesson.content);
        editor?.commands.setContent(parsed.html || "");
        setAudioBlocks(parsed.audio || []);
        setQuizBlocks(parsed.quiz || []);
      } catch (e) {
        // إذا كان نصاً قديماً عادياً
        editor?.commands.setContent(lesson.content);
        setAudioBlocks([]);
        setQuizBlocks([]);
      }
    } else {
      editor?.commands.setContent("");
      setAudioBlocks([]);
      setQuizBlocks([]);
    }
    setView("editor");
  };

  // 4. دالة الحفظ
  const handleSave = async () => {
    if (!editorTitle.trim()) return toast.error(<T>يرجى إدخال عنوان الدرس</T> as unknown as string);
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const isNew = !selectedLesson;
      const url = isNew ? `/api/admin/model-courses/${courseId}/lessons` : `/api/admin/model-courses/${courseId}/lessons/${selectedLesson.id}`;
      
      // ندمج المحتوى مع البلوكات التفاعلية في JSON واحد لنحفظه في عمود Content
      const finalContent = JSON.stringify({
        html: editor?.getHTML(),
        audio: audioBlocks,
        quiz: quizBlocks
      });

      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editorTitle, content: finalContent, type: "video" }),
      });

      if (res.ok) {
        toast.success(<T>تم حفظ السكربت بجميع تفاعلاته بنجاح!</T> as unknown as string);
        fetchLessons();
        setView("list");
      } else throw new Error();
    } catch (error) {
      toast.error(<T>فشل الحفظ، تأكد من الاتصال</T> as unknown as string);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm("هل أنت متأكد من حذف هذا الدرس نهائياً؟")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/model-courses/${courseId}/lessons/${lessonId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success(<T>تم الحذف</T> as unknown as string); fetchLessons(); }
    } catch (error) { toast.error(<T>فشل الحذف</T> as unknown as string); }
  };

  // ==========================================
  // 🤖 5. دوال الذكاء الاصطناعي (Gemini & ElevenLabs)
  // ==========================================
  const generateAIQuiz = async () => {
    const text = editor?.getText();
    if (!text || text.length < 50) return toast.error(<T>يرجى كتابة نص كافٍ أولاً ليستنتج منه الأسئلة</T> as unknown as string);
    
    setAiLoading(true);
    const toastId = toast.loading(<T>يتم الآن تحليل النص وتوليد الأسئلة عبر Gemini...</T> as unknown as string);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: text, type: "quiz" })
      });
      const data = await res.json();
      
      if (data.success) {
        // تنظيف الـ JSON من أي علامات Markdown قد يرسلها Gemini
        const cleanJson = data.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const generatedQuiz = JSON.parse(cleanJson);
        setQuizBlocks([...quizBlocks, { id: Date.now(), questions: generatedQuiz }]);
        toast.success(<T>تم توليد الأسئلة بنجاح!</T> as unknown as string, { id: toastId });
      } else throw new Error();
    } catch (error) {
      toast.error(<T>فشل توليد الأسئلة</T> as unknown as string, { id: toastId });
    } finally { setAiLoading(false); }
  };

  const generateAIAudio = async () => {
    const text = editor?.getText();
    if (!text || text.length < 20) return toast.error(<T>النص قصير جداً للتسجيل</T> as unknown as string);
    
    setAiLoading(true);
    const toastId = toast.loading(<T>جاري تسجيل الصوت عبر ElevenLabs...</T> as unknown as string);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: text.substring(0, 500) }) // تحديد أول 500 حرف للتجربة
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioBlocks([...audioBlocks, { id: Date.now(), url, title: "AI Generated Voiceover" }]);
        toast.success(<T>تم توليد الصوت بنجاح!</T> as unknown as string, { id: toastId });
      } else throw new Error();
    } catch (error) {
      toast.error(<T>فشل توليد الصوت</T> as unknown as string, { id: toastId });
    } finally { setAiLoading(false); }
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary pb-20">
      
      {/* ─── وضع القائمة ─── */}
      {view === "list" && (
        <article className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
          <button onClick={() => router.push("/dashboard/admin")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium mb-8">
            <ArrowRight size={18} className="rotate-180" /> <T>العودة للوحة التحكم</T>
          </button>

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground"><T>إدارة الدروس والسكربتات</T></h1>
              <p className="text-muted-foreground mt-2"><T>قم ببناء المنهج الدراسي وترتيب الدروس التي ستظهر للمعلمين.</T></p>
            </div>
            <button onClick={() => openEditor()} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 shadow-elegant transition-all">
              <Plus size={18} /> <T>إضافة درس جديد</T>
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
                  <button onClick={() => openEditor(lesson)} className="flex items-center gap-2 text-sm font-semibold text-accent-foreground bg-accent/10 px-5 py-2.5 rounded-full hover:bg-accent/20 transition-all"><PenTool size={16} /> <T>تعديل السكربت</T></button>
                </div>
              </div>
            ))}
          </section>
        </article>
      )}

      {/* ─── وضع المحرر (Tiptap + Dynamic Island) ─── */}
      {view === "editor" && (
        <section className="relative min-h-screen bg-muted/20 animate-in zoom-in-95 duration-300">
          
          {/* 🏝️ Dynamic Island (Sticky under Navbar) */}
          <nav className="sticky top-4 mx-auto max-w-4xl z-50 flex items-center justify-between bg-card/90 backdrop-blur-2xl border border-border px-6 py-3 rounded-full shadow-2xl">
            
            {/* Tiptap Formatting Tools */}
            <div className="flex items-center gap-1 border-r border-border pr-4">
              <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded-lg transition-colors ${editor?.isActive('bold') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Bold size={18} /></button>
              <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg transition-colors ${editor?.isActive('italic') ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}><Italic size={18} /></button>
              <button onClick={() => editor?.chain().focus().toggleHighlight().run()} className={`p-2 rounded-lg transition-colors ${editor?.isActive('highlight') ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary'}`}><Highlighter size={18} /></button>
            </div>

            {/* AI Tools (Magical) */}
            <div className="flex items-center gap-2 px-4">
              <button onClick={generateAIAudio} disabled={aiLoading} className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-sm disabled:opacity-50">
                <Mic size={16} /> <T>تسجيل AI</T>
              </button>
              <button onClick={generateAIQuiz} disabled={aiLoading} className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground hover:bg-accent/30 transition-colors font-medium text-sm disabled:opacity-50">
                <Wand2 size={16} /> <T>توليد أسئلة</T>
              </button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <button onClick={() => setView("list")} className="p-2.5 rounded-full hover:bg-destructive/10 text-destructive transition-colors"><X size={20} /></button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <T>حفظ</T>
              </button>
            </div>
          </nav>

          {/* 📄 Paper Canvas */}
          <article className="pt-12 pb-24 px-4 overflow-y-auto flex justify-center">
            <div className="w-full max-w-[850px] bg-background border border-border shadow-md rounded-lg p-10 md:p-20">
              
              <input 
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder="Lesson Title..."
                className="w-full text-4xl md:text-5xl font-serif font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 border-b border-transparent hover:border-border focus:border-primary transition-colors pb-4 mb-8"
              />
              
              {/* Tiptap Rich Text Editor */}
              <EditorContent editor={editor} className="min-h-[300px]" />

              {/* --- Interactive Blocks Section --- */}
              <div className="mt-12 space-y-6">
                
                {/* 1. Audio Blocks Render */}
                {audioBlocks.map((audio, i) => (
                  <div key={i} className="flex items-center justify-between rounded-2xl border border-border bg-secondary/30 p-4">
                    <div className="flex items-center gap-4">
                      <button onClick={() => { const a = new Audio(audio.url); a.play(); }} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 transition-transform">
                        <Play size={20} className="ml-1" />
                      </button>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-primary uppercase"><Wand2 size={12} /> <T>صوت مولد بالذكاء الاصطناعي</T></div>
                        <div className="mt-1 text-sm font-medium text-foreground">{audio.title}</div>
                      </div>
                    </div>
                    <button onClick={() => setAudioBlocks(audioBlocks.filter((_, idx) => idx !== i))} className="text-destructive p-2 hover:bg-destructive/10 rounded-full"><Trash2 size={16}/></button>
                  </div>
                ))}

                {/* 2. Quiz Blocks Render */}
                {quizBlocks.map((quiz, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between bg-secondary/40 px-5 py-3 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <div className="flex items-center gap-2"><CheckSquare size={14} className="text-accent-foreground" /> <T>اختبار تفاعلي (AI)</T></div>
                      <button onClick={() => setQuizBlocks(quizBlocks.filter((_, idx) => idx !== i))} className="text-destructive hover:underline"><T>حذف</T></button>
                    </div>
                    <div className="p-6 space-y-8">
                      {quiz.questions?.map((q: any, qIdx: number) => (
                        <div key={qIdx}>
                          <h3 className="text-lg font-medium text-foreground mb-4 leading-relaxed">{q.question}</h3>
                          <div className="space-y-3">
                            {q.options?.map((opt: any, optIdx: number) => (
                              <div key={optIdx} className={`flex w-full items-center gap-4 rounded-xl border p-3 ${q.correctIndex === optIdx ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}>
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${q.correctIndex === optIdx ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>
                                  {opt.label || String.fromCharCode(65 + optIdx)}
                                </div>
                                <span className="font-medium">{opt.text}</span>
                              </div>
                            ))}
                          </div>
                          {q.explanation && <p className="mt-4 text-sm text-muted-foreground bg-secondary/20 p-3 rounded-lg">💡 {q.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              </div>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}