"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function CreateModelCourse() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"Arabic" | "Quran">("Arabic");
  const [level, setLevel] = useState("");
  const [price, setPrice] = useState("");
  const [scenarioText, setScenarioText] = useState("[]");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يجب تسجيل الدخول");
      return;
    }
    setLoading(true);

    // 1. تحقق من صحة بيانات الكورس
    let scenario;
    try {
      scenario = JSON.parse(scenarioText);
      if (!Array.isArray(scenario)) throw new Error();
    } catch {
      toast.error("صيغة JSON غير صحيحة للسيناريو");
      setLoading(false);
      return;
    }

    const token = await user.getIdToken();

    // 2. إنشاء الكورس أولاً
    const courseRes = await fetch("/api/admin/curriculum", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        category,
        level,
        price: parseFloat(price),
        scenario,
      }),
    });

    if (!courseRes.ok) {
      const err = await courseRes.json();
      toast.error(err.error || "فشل إنشاء الكورس");
      setLoading(false);
      return;
    }

    const courseData = await courseRes.json();
    const courseId = courseData.id; // تأكد أن API يعيد id الكورس الجديد

    toast.success("تم إنشاء الكورس النموذجي");

    // 3. إذا تم رفع ملف PDF، قم بتوليد الدروس تلقائياً
    if (selectedFile) {
      try {
        const genFormData = new FormData();
        genFormData.append("pdfFile", selectedFile);
        genFormData.append("level", level);
        genFormData.append("instructions", ""); // يمكن إضافة تعليمات هنا

        const genRes = await fetch("/api/ai/generate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: genFormData,
        });

        if (!genRes.ok) throw new Error("فشل توليد الدروس");

        const genData = await genRes.json();
        const lessonTitles: string[] = genData.titles;

        // إنشاء درس لكل عنوان
        for (const lessonTitle of lessonTitles) {
          await fetch(`/api/admin/model-course/${courseId}/lessons`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: lessonTitle,
              content: JSON.stringify({ html: "", audio: [], quiz: [] }),
            }),
          });
        }
        toast.success(`تم إنشاء ${lessonTitles.length} درساً بنجاح`);
      } catch (error) {
        toast.error("تم إنشاء الكورس ولكن فشل توليد الدروس تلقائياً");
        console.error(error);
      }
    }

    setLoading(false);
    router.push("/dashboard/admin");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>إنشاء كورس نموذجي</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>اسم الكورس</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as "Arabic" | "Quran")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arabic">لغة عربية</SelectItem>
                  <SelectItem value="Quran">قرآن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الجزء/المستوى</Label>
              <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="مبتدئ، متوسط، A1, B1..." required />
            </div>
            <div>
              <Label>السعر (دولار)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div>
              <Label>سيناريو الدرس الأول (نموذج) - بصيغة JSON</Label>
              <Textarea
                value={scenarioText}
                onChange={(e) => setScenarioText(e.target.value)}
                rows={10}
                placeholder='[{"step":"تحية الطالب", "type":"text"}, {"step":"عرض الآية", "type":"video", "url":""}]'
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                استخدم صيغة JSON لخطوات الدرس. مثال: <br />
                <code>{`[{"step": "مقدمة", "type": "text"}, {"step": "عرض فيديو", "type": "video", "url": "..."}]`}</code>
              </p>
            </div>

            {/* قسم رفع ملف PDF لتوليد المنهج تلقائياً */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold">📄 توليد دروس من كتاب PDF (اختياري)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                بعد إنشاء الكورس، سيتم تحليل الكتاب وإنشاء الدروس تلقائياً.
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              />
              {selectedFile && (
                <p className="text-xs text-green-600 mt-1">تم اختيار: {selectedFile.name}</p>
              )}
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "جاري الإنشاء..." : "إنشاء الكورس" + (selectedFile ? " و توليد الدروس" : "")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}