"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import { 
  ArrowRight, Plus, PenTool, Type, Image, FileVideo, 
  MonitorPlay, X, Save, Loader2, Trash2 
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
  
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");

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

  useEffect(() => {
    fetchLessons();
  }, [user, courseId]);

  const openEditor = (lesson: any = null) => {
    setSelectedLesson(lesson);
    setEditorTitle(lesson ? lesson.title : "");
    setEditorContent(lesson ? (lesson.content || "") : "");
    setView("editor");
  };

  const handleSave = async () => {
    if (!editorTitle.trim()) {
      toast.error(<T>يرجى إدخال عنوان الدرس</T> as unknown as string);
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const isNew = !selectedLesson;
      
      const url = isNew 
        ? `/api/admin/model-courses/${courseId}/lessons` 
        : `/api/admin/model-courses/${courseId}/lessons/${selectedLesson.id}`;
      
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editorTitle,
          content: editorContent,
          type: "video" // قيمة افتراضية
        }),
      });

      if (res.ok) {
        toast.success(<T>تم حفظ الدرس بنجاح</T> as unknown as string);
        fetchLessons(); // تحديث القائمة
        setView("list");
      } else {
        toast.error(<T>فشل حفظ الدرس</T> as unknown as string);
      }
    } catch (error) {
      toast.error(<T>خطأ في الشبكة</T> as unknown as string);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lessonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    // يفضل استبدال confirm بمودال حقيقي، لكن سنستخدمه مؤقتاً
    if (!window.confirm("هل أنت متأكد من حذف هذا الدرس نهائياً؟")) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/model-courses/${courseId}/lessons/${lessonId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success(<T>تم حذف الدرس</T> as unknown as string);
        fetchLessons();
      } else {
        toast.error(<T>فشل الحذف</T> as unknown as string);
      }
    } catch (error) {
      toast.error(<T>خطأ في الشبكة</T> as unknown as string);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      
      {/* ─── عرض قائمة الدروس ─── */}
      {view === "list" && (
        <article className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in duration-500">
          
          <nav className="mb-8">
            <button 
              onClick={() => router.push("/dashboard/admin")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ArrowRight size={18} className="rotate-180" /> <T>العودة للوحة التحكم</T>
            </button>
          </nav>

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">
                <T>إدارة الدروس والسكربتات</T>
              </h1>
              <p className="text-muted-foreground mt-2">
                <T>قم ببناء المنهج الدراسي وترتيب الدروس التي ستظهر للمعلمين.</T>
              </p>
            </div>
            <button 
              onClick={() => openEditor()}
              className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-elegant"
            >
              <Plus size={18} /> <T>إضافة درس جديد</T>
            </button>
          </header>

          <section className="grid gap-4">
            {lessons.map((lesson, idx) => (
              <div 
                key={lesson.id} 
                className="group flex items-center justify-between glass p-5 rounded-2xl border border-border hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-lg">
                    {idx + 1}
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{lesson.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => handleDelete(lesson.id, e)}
                    className="p-2.5 rounded-full text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="حذف الدرس"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => openEditor(lesson)}
                    className="flex items-center gap-2 text-sm font-semibold text-accent-foreground bg-accent/10 px-5 py-2.5 rounded-full hover:bg-accent/20 transition-colors"
                  >
                    <PenTool size={16} /> <T>تعديل السكربت</T>
                  </button>
                </div>
              </div>
            ))}
            
            {lessons.length === 0 && (
              <div className="text-center py-24 border-2 border-dashed border-border/60 rounded-3xl bg-secondary/10">
                <div className="h-16 w-16 bg-secondary text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                  <PenTool size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground"><T>لا توجد دروس بعد</T></h3>
                <p className="text-muted-foreground"><T>ابدأ بإنشاء الدرس الأول وبناء السكربت التفاعلي.</T></p>
              </div>
            )}
          </section>
        </article>
      )}

      {/* ─── مساحة عمل المحرر (Smart Editor) ─── */}
      {view === "editor" && (
        <section className="relative min-h-screen bg-muted/20 animate-in zoom-in-95 duration-300">
          
          {/* Dynamic Island (الشريط العائم) */}
          <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-card/85 backdrop-blur-2xl border border-border px-4 py-2.5 rounded-full shadow-2xl">
            <button className="p-2 rounded-full hover:bg-secondary text-foreground transition-colors" title="نص وتنسيق">
              <Type size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-secondary text-foreground transition-colors" title="إدراج صورة">
              <Image size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-secondary text-foreground transition-colors" title="ربط بـ Google Drive">
              <FileVideo size={18} className="text-accent-foreground" />
            </button>
            <button className="p-2 rounded-full hover:bg-secondary text-foreground transition-colors" title="محتوى H5P تفاعلي">
              <MonitorPlay size={18} className="text-primary" />
            </button>
            
            <div className="w-px h-6 bg-border mx-3" />
            
            <button 
              onClick={() => setView("list")} 
              className="p-2 rounded-full hover:bg-destructive/10 text-destructive transition-colors flex items-center justify-center" 
            >
              <X size={18} />
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors ml-1 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <T>حفظ السكربت</T>
            </button>
          </nav>

          {/* Paper Canvas (الورقة الرقمية A4) */}
          <article className="pt-32 pb-24 px-4 overflow-y-auto min-h-screen flex justify-center">
            <div className="w-full max-w-[850px] min-h-[1100px] bg-background border border-border shadow-md rounded-lg p-10 md:p-20">
              
              {/* التايتل مع تسمية للـ SEO والترجمة */}
              <label htmlFor="lesson-title" className="sr-only"><T>عنوان الدرس</T></label>
              <input 
                id="lesson-title"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder="عنوان الدرس..."
                className="w-full text-4xl md:text-5xl font-serif font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 border-b border-transparent hover:border-border focus:border-primary transition-colors pb-4"
              />
              
              {/* المحرر */}
              <div 
                className="mt-12 text-lg text-foreground/90 outline-none leading-loose min-h-[700px]"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setEditorContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: editorContent }}
              />
              {editorContent === "" && (
                <div className="pointer-events-none -mt-[700px] text-lg text-muted-foreground/40 absolute">
                  <T>ابدأ بكتابة السكربت هنا... يمكنك استخدام الشريط العائم في الأعلى لإدراج الوسائط.</T>
                </div>
              )}

            </div>
          </article>
          
        </section>
      )}

    </main>
  );
}