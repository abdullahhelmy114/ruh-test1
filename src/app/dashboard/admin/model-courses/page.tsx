"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Trash2, BookOpen, Settings, Search,
  AlertCircle, CheckCircle2, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// ─── أنواع البيانات ───────────────────────────────
interface ModelCourse {
  id: string;
  title: string;
  description: string | null;
  level: string;
  price: number;
  category: string | null;
  scenario: string | null;
  created_at: string;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORIES = ["لغة عربية", "قرآن وتجويد", "نحو", "أدب", "محادثة"];

export default function AdminModelCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<ModelCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // حقول النموذج الجديد
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("A1");
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scenario, setScenario] = useState("");

  // ─── جلب النماذج ───────────────────────────────
  const fetchCourses = () => {
    setLoading(true);
    fetch("/api/admin/model-courses", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCourses(data.courses || []))
      .catch(() => setError("فشل جلب الكورسات"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // ─── إنشاء نموذج جديد ─────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/admin/model-courses", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        level,
        price,
        category: category || null,
        description: description || null,
        scenario: scenario || null,
      }),
    });

    if (res.ok) {
      setSuccessMsg("تم إنشاء النموذج بنجاح");
      setTitle("");
      setLevel("A1");
      setPrice(0);
      setCategory("");
      setDescription("");
      setScenario("");
      setDialogOpen(false);
      fetchCourses();
      setTimeout(() => setSuccessMsg(""), 3000);
    } else {
      const err = await res.json();
      setError(err.error || "فشل الإنشاء");
    }
    setSubmitting(false);
  };

  // ─── حذف نموذج ─────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا النموذج؟")) return;
    setDeletingId(id);
    await fetch(`/api/admin/model-courses/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setDeletingId(null);
    fetchCourses();
  };

  // ─── فلترة البحث ──────────────────────────────
  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            <T>الكورسات النموذجية</T>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <T>إدارة النماذج المعتمدة التي يمكن للمعلمين طلب تدريسها</T>
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus size={18} />
              <T>نموذج جديد</T>
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground text-xl"><T>إنشاء نموذج كورس</T></DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground"><T>اسم الكورس</T></label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: قواعد النحو العربي – المستوى الأول"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground"><T>المستوى</T></label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground"><T>السعر ($)</T></label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="mt-1"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground"><T>التصنيف</T></label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="اختر تصنيفاً (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground"><T>الوصف</T></label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر للكورس..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground"><T>السيناريو التعليمي</T></label>
                <Textarea
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder="ملاحظات أو سيناريو تعليمي (اختياري)..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-xl">
                  <AlertCircle size={16} /> <T>{error}</T>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={submitting || !title.trim()}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <T>إنشاء</T>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* رسالة نجاح */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-primary/10 text-primary p-3 rounded-xl text-sm"
        >
          <CheckCircle2 size={16} /> <T>{successMsg}</T>
        </motion.div>
      )}

      {/* مربع البحث */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن نموذج..."
          className="w-full rounded-full border border-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* شبكة النماذج */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="mx-auto h-16 w-16 mb-4 text-accent-foreground/50" />
          <p className="text-lg font-serif"><T>لا توجد نماذج بعد</T></p>
          <p className="text-sm mt-2"><T>اضغط على "نموذج جديد" لإضافة أول كورس نموذجي</T></p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <Card key={course.id} className="bg-card border-border hover:border-primary/30 transition">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-foreground">{course.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {course.description?.slice(0, 80) || <T>لا يوجد وصف</T>}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge variant="secondary" className="text-xs">{course.level}</Badge>
                  {course.category && <Badge variant="outline" className="text-xs">{course.category}</Badge>}
                  <Badge className="text-xs bg-primary/10 text-primary">${course.price}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/dashboard/admin/model-courses/${course.id}/lessons`)}
                  className="text-muted-foreground hover:text-foreground gap-1"
                >
                  <Settings size={15} />
                  <T>الدروس النموذجية</T>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(course.id)}
                  disabled={deletingId === course.id}
                  className="text-destructive hover:bg-destructive/10"
                >
                  {deletingId === course.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}