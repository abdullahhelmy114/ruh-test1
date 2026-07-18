"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

// ========== أنواع البيانات ==========
interface IrabWord {
  word: string;
  type: string;
  position: string;
  sign: { text: string; type: string };
}

// ========== لوحة الألوان حسب النوع ==========
const TYPE_COLORS: Record<string, string> = {
  'حرف': '#cc3333',
  'فعل': '#cc5500',
  'اسم': '#0099bb',
  'ضمير': '#b22222',
  'نعت': '#b84a8a',
  'مبتدأ': '#2e7d32',
  'خبر': '#00695c',
  'مفعول_به': '#8e24aa',
  'مضاف_إليه': '#00897b',
  'جار_ومجرور': '#bf8f00',
  'بدل': '#3949ab',
  'اسم_موصول': '#1565c0',
  'اسم_اشارة': '#558b2f',
  'ظرف': '#bf5e00',
  'فاعل': '#00695c',
  'تمييز': '#9c27b0',
  'حال': '#006064',
  'مبني': '#555555',
  'غير_محدد': '#888888',
  'اسم_ان': '#2e7d32',
  'خبر_ان': '#00695c',
  'مجرور_بحرف_جر': '#bf8f00',
};

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
      // عدد آيات السورة السابقة غير معروف بدون API، سنكتفي بالرجوع لآية 1
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
          <h2 className="text-xl font-bold">
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
          {words.map((w, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
              className={`px-1.5 py-0.5 rounded-md transition-all duration-200 hover:scale-110 ${
                selectedIdx === i ? 'ring-2 ring-offset-2 bg-accent/30' : ''
              }`}
              style={{ color: TYPE_COLORS[w.type] || '#000', borderColor: TYPE_COLORS[w.type] || '#000' }}
            >
              {w.word}
            </button>
          ))}
        </div>
      </div>

      {/* جدول التحليل */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-right font-semibold">الكلمة</th>
                <th className="px-4 py-3 text-right font-semibold">النوع</th>
                <th className="px-4 py-3 text-right font-semibold">الموقع الإعرابي</th>
                <th className="px-4 py-3 text-right font-semibold">العلامة الإعرابية</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
                  className={`border-b border-border cursor-pointer transition-colors ${
                    selectedIdx === i ? 'bg-accent/30' : 'hover:bg-muted/20'
                  }`}
                >
                  <td className="px-4 py-3 font-arabic text-lg" style={{ color: TYPE_COLORS[w.type] || '#333' }}>
                    {w.word}
                  </td>
                  <td className="px-4 py-3">{w.type}</td>
                  <td className="px-4 py-3">{POSITION_LABELS[w.position] || w.position}</td>
                  <td className="px-4 py-3">{w.sign.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}