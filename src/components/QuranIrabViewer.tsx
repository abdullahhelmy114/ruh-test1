"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Volume2, Languages } from "lucide-react";
import { fetchTranslation, getAyahAudioUrl, getWordAudioUrl } from "@/lib/quran-api";

interface IrabWord {
  word: string;
  type: string;
  position: string;
  sign: { text: string; type: string };
}

function getWordColor(word: string): string {
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

const POSITION_LABELS: Record<string, string> = {
  'مبتدأ': 'مبتدأ', 'خبر': 'خبر', 'فاعل': 'فاعل', 'مفعول_به': 'مفعول به',
  'مضاف_إليه': 'مضاف إليه', 'جار_ومجرور': 'جار ومجرور', 'معطوف': 'معطوف',
  'نعت': 'نعت', 'حال': 'حال', 'تمييز': 'تمييز', 'بدل': 'بدل', 'مبني': 'مبني',
  'غير_محدد': 'غير محدد', 'مجرور_بحرف_جر': 'مجرور بحرف جر',
  'اسم_ان': 'اسم إن', 'خبر_ان': 'خبر إن',
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
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [lang, setLang] = useState<"en" | "tr">("en");
  const [goToAyah, setGoToAyah] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchAyahData = async (s: number, a: number) => {
    setLoading(true);
    setError(null);
    setSelectedIdx(null);
    setTranslation("");
    try {
      const [irabRes, transRes] = await Promise.all([
        fetch(`/api/quran-irab?surah=${s}&ayah=${a}`),
        fetchTranslation(s, a, lang),
      ]);
      if (!irabRes.ok) {
        const errData = await irabRes.json();
        throw new Error(errData.error || "Ayah not found");
      }
      const irabData = await irabRes.json();
      setWords(irabData.words || []);
      setTranslation(transRes || "");
    } catch (e: any) {
      setError(e.message || "خطأ");
      setWords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAyahData(surah, ayah);
  }, [surah, ayah, lang]);

  const goNext = () => setAyah((prev) => prev + 1);
  const goPrev = () => setAyah((prev) => prev - 1);

  const playAyahAudio = () => {
    if (audioRef.current) {
      audioRef.current.src = getAyahAudioUrl(surah, ayah);
      audioRef.current.play();
    }
  };

  const playWordAudio = (idx: number) => {
    if (audioRef.current) {
      audioRef.current.src = getWordAudioUrl(surah, ayah, idx + 1);
      audioRef.current.play();
    }
  };

  const handleGoToAyah = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseInt(goToAyah, 10);
    if (a >= 1) setAyah(a);
    setGoToAyah("");
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-destructive">{error}</div>
        <Link href="/quran" className="text-primary hover:underline">العودة لفهرس السور</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6" dir="rtl">
      <audio ref={audioRef} className="hidden" />

      {/* شريط التنقل العلوي */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={surah === 1 && ayah === 1}>
            <ChevronRight className="h-4 w-4 ml-1" /> السابق
          </Button>
          {ayah === 1 && surah > 1 && (
            <Link href={`/quran/${surah - 1}`} className="text-sm text-muted-foreground hover:underline self-center">
              السورة السابقة
            </Link>
          )}
        </div>

        <div className="text-center flex-1">
          <h2 className="text-xl font-bold text-foreground">سورة {surah} - آية {ayah}</h2>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goNext}>التالي <ChevronLeft className="h-4 w-4 mr-1" /></Button>
          {surah < 114 && (
            <Link href={`/quran/${surah + 1}`} className="text-sm text-primary hover:underline self-center">السورة التالية</Link>
          )}
        </div>
      </div>

      {/* الانتقال لآية */}
      <form onSubmit={handleGoToAyah} className="flex justify-center gap-2">
        <Input type="number" min={1} placeholder="رقم الآية" value={goToAyah} onChange={(e) => setGoToAyah(e.target.value)} className="w-24 text-center" />
        <Button type="submit" variant="outline" size="sm">اذهب</Button>
      </form>

      {/* أزرار الترجمة والصوت */}
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLang(lang === "en" ? "tr" : "en")}>
          <Languages className="h-4 w-4 ml-1" /> {lang === "en" ? "Türkçe" : "English"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowTranslation(!showTranslation)}>
          {showTranslation ? "إخفاء الترجمة" : "ترجمة"}
        </Button>
        <Button variant="ghost" size="sm" onClick={playAyahAudio}>
          <Volume2 className="h-4 w-4 ml-1" /> تشغيل الآية
        </Button>
      </div>

      {/* عرض الآية مع ترجمة اختيارية */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-wrap justify-center gap-2 text-2xl md:text-4xl font-arabic leading-loose">
          {words.map((w, i) => {
            const color = getWordColor(w.word);
            return (
              <div key={i} className="flex flex-col items-center">
                <button
                  onClick={() => { setSelectedIdx(i === selectedIdx ? null : i); playWordAudio(i); }}
                  className={`px-2 py-1 rounded-md transition hover:scale-110 ${selectedIdx === i ? 'ring-2 ring-primary' : ''}`}
                  style={{ color }}
                >
                  {w.word}
                </button>
                {showTranslation && translation && <span className="text-xs text-muted-foreground">{/* ترجمة الكلمة */}</span>}
              </div>
            );
          })}
        </div>
        {showTranslation && translation && <div className="mt-4 text-sm text-muted-foreground text-center border-t pt-3">{translation}</div>}
      </div>

      {/* جدول التحليل */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-right text-foreground">الكلمة</th>
                <th className="px-4 py-3 text-right text-foreground">النوع</th>
                <th className="px-4 py-3 text-right text-foreground">الموقع الإعرابي</th>
                <th className="px-4 py-3 text-right text-foreground">العلامة الإعرابية</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, i) => {
                const color = getWordColor(w.word);
                const isSel = selectedIdx === i;
                return (
                  <tr key={i} onClick={() => setSelectedIdx(i === selectedIdx ? null : i)} className={`border-b border-border cursor-pointer transition ${isSel ? 'bg-primary/10' : 'hover:bg-muted/20'}`}>
                    <td className="px-4 py-3 font-arabic text-lg font-medium" style={{ color }}>{w.word}</td>
                    <td className="px-4 py-3" style={{ color }}>{w.type}</td>
                    <td className="px-4 py-3" style={{ color }}>{POSITION_LABELS[w.position] || w.position}</td>
                    <td className="px-4 py-3" style={{ color }}>{w.sign.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة منبثقة للكلمة المختارة */}
      {selectedIdx !== null && words[selectedIdx] && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
          <div className="rounded-2xl border-2 p-4 shadow-xl max-w-md text-center" style={{ borderColor: getWordColor(words[selectedIdx].word), backgroundColor: 'var(--background)' }}>
            <p className="font-arabic text-xl mb-2" style={{ color: getWordColor(words[selectedIdx].word) }}>{words[selectedIdx].word}</p>
            <p className="text-sm text-foreground"><strong>{words[selectedIdx].type}</strong> – {POSITION_LABELS[words[selectedIdx].position]} – {words[selectedIdx].sign.text}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedIdx(null)}>إغلاق</Button>
          </div>
        </div>
      )}
    </div>
  );
}