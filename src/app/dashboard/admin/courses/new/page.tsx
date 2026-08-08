"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const THEMES = [
  { value: "theme-1", label: "ثيم أكاديمي" },
  { value: "theme-2", label: "ثيم تفاعلي" },
  { value: "theme-3", label: "ثيم بسيط" },
  { value: "theme-4", label: "ثيم غامر" },
];

export default function NewCoursePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("A1");
  const [description, setDescription] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [price, setPrice] = useState(0);
  const [oldPrice, setOldPrice] = useState<number | undefined>();
  const [launchDate, setLaunchDate] = useState("");
  const [courseDuration, setCourseDuration] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [instructorName, setInstructorName] = useState("د. جيهان علي زياد");
  const [theme, setTheme] = useState("theme-1");

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName }) });
    const { categories: updated } = await fetch("/api/categories").then(r => r.json());
    setCategories(updated);
    setNewCategoryName("");
    setShowCategoryDialog(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, title, level, description, intro_video_url: introVideoUrl, thumbnail_url: thumbnailUrl, price, old_price: oldPrice, launch_date: launchDate, course_duration: courseDuration, lesson_duration: lessonDuration, instructor_name: instructorName, theme }),
      });
      if (res.ok) router.push("/dashboard/admin/courses");
      else setError("فشل إنشاء الكورس");
    } catch { setError("خطأ في الشبكة"); }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 py-8">
      <h1 className="font-serif text-3xl mb-8"><T>إنشاء كورس جديد</T></h1>
      <div className="glass rounded-3xl p-6 space-y-6">
        {/* الفئة + فئة جديدة */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label><T>الفئة</T></Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus size={16} /> <T>فئة جديدة</T></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle><T>إضافة فئة</T></DialogTitle></DialogHeader>
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="اسم الفئة" />
              <DialogFooter><Button onClick={handleAddCategory}><T>حفظ</T></Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* اسم الكورس */}
        <div><Label><T>اسم الكورس</T></Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: اللغة العربية للمبتدئين" /></div>

        {/* المستوى */}
        <div>
          <Label><T>المستوى</T></Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["A1","A2","B1","B2","C1","C2"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* وصف الكورس */}
        <div><Label><T>وصف الكورس</T></Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="وصف تفصيلي..." /></div>

        {/* فيديو يوتيوب */}
        <div><Label><T>رابط الفيديو التعريفي (YouTube)</T></Label><Input value={introVideoUrl} onChange={e => setIntroVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>

        {/* صورة مصغرة للفيديو */}
        <div><Label><T>رابط الصورة المصغرة (اختياري)</T></Label><Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://example.com/thumb.jpg" /></div>

        {/* السعر + السعر القديم */}
        <div className="grid grid-cols-2 gap-4">
          <div><Label><T>السعر ($)</T></Label><Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><Label><T>السعر القديم (اختياري)</T></Label><Input type="number" value={oldPrice ?? ''} onChange={e => setOldPrice(e.target.value ? Number(e.target.value) : undefined)} /></div>
        </div>

        {/* موعد الانطلاق */}
        <div><Label><T>موعد الانطلاق</T></Label><Input type="datetime-local" value={launchDate} onChange={e => setLaunchDate(e.target.value)} /></div>

        {/* المدة */}
        <div className="grid grid-cols-2 gap-4">
          <div><Label><T>مدة الكورس</T></Label><Input value={courseDuration} onChange={e => setCourseDuration(e.target.value)} placeholder="12 أسبوع" /></div>
          <div><Label><T>مدة الدرس</T></Label><Input value={lessonDuration} onChange={e => setLessonDuration(e.target.value)} placeholder="45 دقيقة" /></div>
        </div>

        {/* المقدم */}
        <div><Label><T>المُقدم</T></Label><Input value={instructorName} onChange={e => setInstructorName(e.target.value)} /></div>

        {/* الثيم */}
        <div>
          <Label><T>ثيم صفحة الهبوط</T></Label>
          <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-2 gap-3 mt-2">
            {THEMES.map(t => (
              <label key={t.value} className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition ${theme === t.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <RadioGroupItem value={t.value} id={t.value} />
                <div><p className="font-medium text-sm"><T>{t.label}</T></p></div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={loading} className="w-full rounded-full bg-primary text-primary-foreground py-6 text-base">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : <T>نشر الكورس</T>}
        </Button>
      </div>
    </div>
  );
}