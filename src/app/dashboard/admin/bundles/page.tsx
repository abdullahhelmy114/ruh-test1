"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Plus, Trash2, Package, Sparkles, CheckCircle2, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface ModelCourse {
  id: string;
  title: string;
  level: string;
  price: number;
}

interface Bundle {
  id: string;
  title: string;
  description: string | null;
  price: number;
  model_course_ids: string[];
  featured: boolean;
  created_at: string;
}

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [modelCourses, setModelCourses] = useState<ModelCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // حقول إنشاء حزمة جديدة
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(0);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);

  // جلب البيانات
  const fetchData = async () => {
    setLoading(true);
    try {
      const [modelRes, bundleRes] = await Promise.all([
        fetch("/api/admin/model-courses", { credentials: "include" }),
        fetch("/api/bundles", { credentials: "include" }),
      ]);
      const modelData = await modelRes.json();
      const bundleData = await bundleRes.json();
      setModelCourses(modelData.courses || []);
      setBundles(bundleData.bundles || []);
    } catch {
      setError("فشل جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // إنشاء حزمة جديدة
  const handleCreate = async () => {
    if (!title.trim() || selectedCourses.length !== 3) {
      setError("يجب إدخال عنوان واختيار 3 كورسات");
      return;
    }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/admin/bundles", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        price,
        model_course_ids: selectedCourses,
        featured,
      }),
    });

    if (res.ok) {
      setSuccessMsg("تم إنشاء الحزمة بنجاح");
      setTitle("");
      setDescription("");
      setPrice(0);
      setSelectedCourses([]);
      setFeatured(false);
      setDialogOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } else {
      const err = await res.json();
      setError(err.error || "فشل إنشاء الحزمة");
    }
    setSubmitting(false);
  };

  // إضافة/إزالة كورس من الاختيار (حد أقصى 3)
  const toggleCourse = (id: string) => {
    setSelectedCourses(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            <T>إدارة الحزم</T>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <T>أنشئ حزماً من 3 كورسات نموذجية بسعر مخفض</T>
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              <Plus size={18} />
              <T>حزمة جديدة</T>
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground text-xl"><T>إنشاء حزمة</T></DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground"><T>عنوان الحزمة</T></label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: الباقة الذهبية للمبتدئين"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground"><T>الوصف</T></label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="وصف مختصر..."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="rounded"
                    />
                    <Sparkles size={14} className="text-accent" /> <T>حزمة مميزة</T>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  <T>اختر 3 كورسات نموذجية</T> ({selectedCourses.length}/3)
                </label>
                <div className="mt-2 grid gap-2 max-h-48 overflow-y-auto border border-border rounded-xl p-2">
                  {modelCourses.map(course => (
                    <div
                      key={course.id}
                      onClick={() => toggleCourse(course.id)}
                      className={`flex items-center justify-between rounded-lg p-2 cursor-pointer border transition ${
                        selectedCourses.includes(course.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-secondary"
                      }`}
                    >
                      <span className="text-sm">{course.title} ({course.level})</span>
                      {selectedCourses.includes(course.id) && (
                        <CheckCircle2 size={16} className="text-primary" />
                      )}
                    </div>
                  ))}
                </div>
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
                disabled={submitting || !title.trim() || selectedCourses.length !== 3}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                <T>إنشاء الحزمة</T>
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

      {/* قائمة الحزم الحالية */}
      {bundles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="mx-auto h-16 w-16 mb-4 text-accent-foreground/50" />
          <p className="text-lg"><T>لا توجد حزم بعد</T></p>
          <p className="text-sm mt-2"><T>أنشئ أول حزمة من 3 كورسات نموذجية</T></p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map(bundle => (
            <div key={bundle.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-foreground">{bundle.title}</h3>
                {bundle.featured && <Sparkles size={16} className="text-accent" />}
              </div>
              {bundle.description && (
                <p className="text-xs text-muted-foreground">{bundle.description}</p>
              )}
              <p className="text-xl font-bold text-primary">${bundle.price}</p>
              <div className="flex flex-wrap gap-1">
                {bundle.model_course_ids.map((id: string) => {
                  const course = modelCourses.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {course?.title || id.slice(0,8)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}