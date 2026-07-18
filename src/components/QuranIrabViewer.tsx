"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

// ========== أنواع ==========
interface IrabWord {
  word: string;
  type: string;
  position: string;
  sign: { text: string; type: string };
}

// ========== دالة توليد لون ثابت لكل كلمة ==========
function getWordColor(word: string): string {
  // لوحة ألوان متناسقة مع الهوية الكحلية والبيج
  const palette = [
    "#1e3a5f", "#2c4a6e", "#3b5a7d", "#4a6a8c", "#597a9b",
    "#2e4a3a", "#3d5a4a", "#4c6a5a", "#5b7a6a", "#6a8a7a",
    "#5f3a1e", "#6e4a2d", "#7d5a3c", "#8c6a4b", "#9b7a5a",
    "#5f1e3a", "#6e2d4a", "#7d3c5a", "#8c4b6a", "#9b5a7a",
  ];
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = word.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

// ترجمة المواقع الإعرابية للعرض
const POSITION_LABELS: Record<string, string> = {
  'مبتدأ': 'مبتدأ',
  'خبر': 'خبر',
  'فاعل': 'فاعل',
  'مفعول_به': 'مفعول به',
  'مضاف_إليه': 'مضاف إليه',
  'جار_ومجرور': 'جار ومجرور',
  'معطوف': 'معطوف',
  'نعت': 'نعت',
  'حال': 'حال',
  'تمييز': 'تمييز',
  'بدل': 'بدل',
  'مبني': 'مبني',
  'غير_محدد': 'غير محدد',
  'مجرور_بحرف_جر': 'مجرور بحرف جر',
  'اسم_ان': 'اسم إن',
  'خبر_ان': 'خبر إن',
};

export default function QuranIrabViewer({
  initialSurah = 1,
  initialAyah = 1,
}: {
  initialSurah?: number;
  initialAyah?: number;
}) {
  const [surah, setSurah] = useState(initialSurah);
  const [ayah, setAyah] = useState(initialAyah);
  const [words, setWords] = useState<IrabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const fetchAyah = async (s: number, a: number) => {
    setLoading(true);
    setError(null);
    setSelectedIdx(null);
    try {
      const res = await fetch(`/api/quran-irab?surah=${s}&ayah=${a}`);
      if (!res.ok) {
        setError("تعذر تحميل الآية");
        setWords([]);
        return;
      }
      const data = await res.json();
      setWords(data.words || []);
    } catch {
      setError("خطأ في الاتصال");
      setWords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAyah(surah, ayah);
  }, [surah, ayah]);

  const goNext = () => {
    if (ayah < 286) setAyah(ayah + 1);
    else if (surah < 114) { setSurah(surah + 1); setAyah(1); }
  };

  const goPrev = () => {
    if (ayah > 1) setAyah(ayah - 1);
    else if (surah > 1) {
      setSurah(surah - 1);
      setAyah(1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-destructive">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6" dir="rtl">
      {/* شريط التنقل */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={surah === 1 && ayah === 1}>
          <ChevronRight className="h-4 w-4 ml-2" /> السابق
        </Button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">
            سورة {surah} - آية {ayah}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={goNext} disabled={surah === 114 && ayah === 286}>
          التالي <ChevronLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>

      {/* عرض الآية */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-wrap justify-center gap-2 text-2xl md:text-4xl font-arabic leading-loose">
          {words.map((w, i) => {
            const wordColor = getWordColor(w.word);
            return (
              <button
                key={i}
                onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
                className={`px-2 py-1 rounded-md transition-all duration-200 hover:scale-110 ${
                  selectedIdx === i ? 'ring-2 ring-offset-2 ring-primary' : ''
                }`}
                style={{
                  color: wordColor,
                  fontWeight: 500,
                }}
              >
                {w.word}
              </button>
            );
          })}
        </div>
      </div>

      {/* جدول التحليل */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-right font-semibold text-foreground">الكلمة</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">النوع</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">الموقع الإعرابي</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">العلامة الإعرابية</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => {
                const wordColor = getWordColor(w.word);
                const isSelected = selectedIdx === i;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
                    className={`border-b border-border cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/20'
                    }`}
                  >
                    <td
                      className="px-4 py-3 font-arabic text-lg font-medium"
                      style={{ color: wordColor }}
                    >
                      {w.word}
                    </td>
                    <td className="px-4 py-3 text-foreground">{w.type}</td>
                    <td className="px-4 py-3 text-foreground">{POSITION_LABELS[w.position] || w.position}</td>
                    <td className="px-4 py-3 text-foreground">{w.sign.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}