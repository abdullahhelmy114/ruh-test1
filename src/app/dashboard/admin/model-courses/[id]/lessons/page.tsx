"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, Plus, Trash2, GripVertical, BookOpen,
  Video, FileText, Monitor, AlertCircle, ArrowLeft,
  Eye, Save
} from "lucide-react";
import { motion, Reorder } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// ─── أنواع البيانات ───────────────────────────────
interface ModelLesson {
  id: string;
  title: string;
  order_index: number;
  type: string;
  script_pdf_url?: string | null;
  duration_minutes?: number | null;
}

interface ModelCourse {
  id: string;
  title: string;
}

const LESSON_TYPES = [
  { value: "video", label: "فيديو مسجل", icon: Video },
  { value: "zoom", label: "مباشر (Zoom)", icon: Monitor },
  { value: "pdf", label: "ملف PDF", icon: FileText },
];

export default function AdminModelLessonsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const modelId = params.id;
  const { user } = useAuth();

  const [course, setCourse] = useState<ModelCourse | null>(null);
  const [lessons, setLessons] = useState<ModelLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // حقل إضافة درس جديد
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("video");
  const [newDuration, setNewDuration] = useState(30);
  const [newScriptUrl, setNewScriptUrl] = useState("");

  // دالة مساعدة لجلب التوكن
  const getToken = () => user?.getIdToken() ?? Promise.resolve("");

  // ─── جلب بيانات النموذج والدروس ─────────────────
  useEffect(() => {
    if (!modelId || !user) return;
    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(`/api/admin/model-courses/${modelId}/lessons`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setCourse(data.course);
          setLessons(data.lessons || []);
        } else {
          setError(data.error || "فشل تحميل البيانات");
        }
      } catch {
        setError("خطأ في الشبكة");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [modelId, user]);

  // ─── إضافة درس جديد ────────────────────────────
  const handleAddLesson = async () => {
    if (!newTitle.trim() || !user) return;
    setSaving(true);
    setError("");

    const token = await getToken();
    const res = await fetch(`/api/admin/model-courses/${modelId}/lessons`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: newTitle,
        type: newType,
        duration_minutes: newDuration,
        script_pdf_url: newScriptUrl || null,
        order_index: lessons.length,
      }),
    });

    if (res.ok) {
      setSuccess("تمت إضافة الدرس");
      setNewTitle("");
      setNewType("video");
      setNewDuration(30);
      setNewScriptUrl("");
      setDialogOpen(false);
      const data = await res.json();
      setLessons(prev => [...prev, data.lesson]);
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const err = await res.json();
      setError(err.error || "فشل إضافة الدرس");
    }
    setSaving(false);
  };

  // ─── حذف درس ──────────────────────────────────
  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("حذف هذا الدرس؟") || !user) return;
    const token = await getToken();
    await fetch(`/api/admin/model-lessons/${lessonId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    setLessons(prev => prev.filter(l => l.id !== lessonId));
  };

  // ─── إعادة ترتيب الدروس ────────────────────────
  const handleReorder = (reordered: ModelLesson[]) => {
    setLessons(reordered);
    if (!user) return;
    const tokenPromise = getToken();
    const updates = reordered.map((l, idx) => ({
      id: l.id,
      order_index: idx,
    }));
    tokenPromise.then(token =>
      fetch(`/api/admin/model-courses/${modelId}/lessons/reorder`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lessons: updates }),
      }).catch(() => setError("فشل حفظ الترتيب"))
    );
  };

  // ─── حالة التحميل ─────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // ─── التصميم ───────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* زر العودة */}
      <Button
        variant="ghost"
        onClick={() => router.push("/dashboard/admin/model-courses")}
        className="text-gray-500 hover:text-gray-900 gap-2"
      >
        <ArrowLeft size={16} />
        <T>العودة إلى النماذج</T>
      </Button>

      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">
            <T>الدروس النموذجية</T>
          </h1>
          {course && (
            <p className="text-sm text-gray-500 mt-1">
              {course.title}
            </p>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700 gap-2">
              <Plus size={18} />
              <T>إضافة درس</T>
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-gray-900"><T>إضافة درس نموذجي</T></DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500"><T>عنوان الدرس</T></label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: مقدمة في مخارج الحروف"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500"><T>النوع</T></label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LESSON_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            <t.icon size={14} /> {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500"><T>المدة (دقيقة)</T></label>
                  <Input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="mt-1"
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-gray-500"><T>رابط السكريبت (PDF)</T></label>
                <Input
                  value={newScriptUrl}
                  onChange={(e) => setNewScriptUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  <T>رابط اختياري لملف PDF يحتوي على سكريبت الدرس</T>
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-xl">
                  <AlertCircle size={16} /> <T>{error}</T>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={handleAddLesson}
                disabled={saving || !newTitle.trim()}
                className="bg-amber-100text-amber-700 hover:bg-accent/90"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <T>حفظ</T>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* رسائل الخطأ والنجاح */}
      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-emerald-500/10 text-primary p-3 rounded-xl text-sm">
          <T>{success}</T>
        </motion.div>
      )}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-destructive/10 text-destructive p-3 rounded-xl text-sm">
          <T>{error}</T>
        </motion.div>
      )}

      {/* قائمة الدروس مع إعادة الترتيب */}
      {lessons.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BookOpen className="mx-auto h-12 w-12 mb-3 text-gray-500/50" />
          <p><T>لا توجد دروس نموذجية بعد</T></p>
          <p className="text-sm mt-1"><T>أضف الدروس التي سيدرسها المعلم بالترتيب</T></p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={lessons}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {lessons.map((lesson, index) => {
            const TypeIcon = LESSON_TYPES.find(t => t.value === lesson.type)?.icon || FileText;
            return (
              <Reorder.Item key={lesson.id} value={lesson} className="list-none">
                <motion.div
                  layout
                  className="glass rounded-xl p-4 flex items-center gap-3 group hover:bg-card/80 transition"
                >
                  <div className="cursor-grab text-gray-500 hover:text-gray-900">
                    <GripVertical size={18} />
                  </div>
                  <span className="text-sm text-gray-500 font-mono w-6 text-center">
                    {index + 1}
                  </span>
                  <TypeIcon size={18} className="text-amber-700" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{lesson.title}</p>
                    <p className="text-xs text-gray-500">
                      {lesson.type} · {lesson.duration_minutes || "—"} دقيقة
                    </p>
                  </div>
                  {lesson.script_pdf_url && (
                    <a
                      href={lesson.script_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-xs rounded-full bg-emerald-500/10 text-primary hover:bg-emerald-500/20"
                      title="عرض السكريبت"
                    >
                      <Eye size={14} />
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteLesson(lesson.id)}
                    className="text-gray-500 hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 size={15} />
                  </Button>
                </motion.div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </div>
  );
}