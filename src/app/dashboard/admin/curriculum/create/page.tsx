"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function CreateModelCourse() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"Arabic" | "Quran">("Arabic");
  const [level, setLevel] = useState("");
  const [price, setPrice] = useState("");
  const [scenarioText, setScenarioText] = useState("[]");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let scenario;
    try {
      scenario = JSON.parse(scenarioText);
      if (!Array.isArray(scenario)) throw new Error();
    } catch {
      toast.error("صيغة JSON غير صحيحة للسيناريو");
      setLoading(false);
      return;
    }

   const res = await fetch("/api/admin/curriculum", {
      method: "POST",
      credentials: "include", // 👈 هذا هو السطر السحري الذي كان مفقوداً!
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        level,
        price: parseFloat(price),
        scenario,
      }),
    });

    if (res.ok) {
      toast.success("تم إنشاء الكورس النموذجي");
      router.push("/dashboard/admin");
    } else {
      toast.error("فشل إنشاء الكورس");
    }
    setLoading(false);
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
              <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="مبتدئ، متوسط، 30، 29..." required />
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
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "إنشاء الكورس"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}