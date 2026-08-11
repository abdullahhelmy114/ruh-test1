"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, ChevronLeft, Volume2, HelpCircle, BookOpen, AlertCircle } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { fetchTranslation } from "@/lib/quran-api";

// ========== أنواع ==========
interface IrabComponent {
  text: string;
  type: string;
  position: string;
  sign: string;
}

interface AnalyzedWord {
  word: string;
  components: IrabComponent[];
  meaning?: string;
  root?: string;
}

// ========== لون ثابت لكل كلمة ==========
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

// ========== أدلة المساعدة ==========
const HELP_TEXTS: Record<string, Record<string, string>> = {
  ar: {
    type: "نوع الكلمة: يصف التصنيف النحوي للكلمة (اسم، فعل، حرف، ضمير، إلخ).",
    position: "الموقع الإعرابي: يحدد وظيفة الكلمة في الجملة (مبتدأ، خبر، فاعل، مفعول به، إلخ).",
    sign: "العلامة الإعرابية: الحركة أو الحرف الذي يدل على حالة الكلمة الإعرابية (رفع، نصب، جر، جزم).",
  },
  en: {
    type: "Word Type: Describes the grammatical category of the word (noun, verb, particle, pronoun, etc.).",
    position: "Grammatical Position: Specifies the function of the word in the sentence (subject, predicate, doer, object, etc.).",
    sign: "Inflection Sign: The diacritic or letter indicating the grammatical case (nominative, accusative, genitive, jussive).",
  },
  tr: {
    type: "Kelime Türü: Kelimenin gramer kategorisini tanımlar (isim, fiil, edat, zamir vb.).",
    position: "Gramatik Konum: Kelimenin cümledeki işlevini belirtir (özne, yüklem, fail, nesne vb.).",
    sign: "İrab İşareti: Kelimenin gramer durumunu gösteren hareke veya harf (ref, nasb, cer, cezm).",
  },
};

export default function QuranIrabViewer() {
  const params = useParams();
  const surah = parseInt(params?.surah as string, 10);
  const ayah = parseInt(params?.ayah as string, 10);

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    const stored = localStorage.getItem("preferred-locale");
    if (stored) setLocale(stored);
  }, []);

  const [words, setWords] = useState<AnalyzedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWordIdx, setSelectedWordIdx] = useState<number | null>(null);
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [tafsir, setTafsir] = useState("");
  const [showTafsir, setShowTafsir] = useState(false);
  const [goToAyah, setGoToAyah] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [helpContent, setHelpContent] = useState("");

  const fetchAyahData = async (s: number, a: number) => {
    setLoading(true);
    setError(null);
    setSelectedWordIdx(null);
    setTranslation("");
    setTafsir("");
    try {
      const translationLang = locale === "ar" ? "en" : locale === "tr" ? "tr" : "en";
      const [irabRes, transRes] = await Promise.all([
        fetch(`/api/quran-irab?surah=${s}&ayah=${a}`),
        fetchTranslation(s, a, translationLang),
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

  const loadTafsir = async () => {
    try {
      const res = await fetch(`/api/quran-tafsir?surah=${surah}&ayah=${ayah}`);
      const data = await res.json();
      setTafsir(data.tafsir || "");
      setShowTafsir(true);
    } catch {
      setError("تعذر تحميل التفسير");
    }
  };

  useEffect(() => {
    if (isNaN(surah) || isNaN(ayah)) {
      setError("رابط غير صالح");
      setLoading(false);
      return;
    }
    fetchAyahData(surah, ayah);
  }, [surah, ayah, locale]);

  const goNext = () => {
    if (!isNaN(surah) && !isNaN(ayah)) {
      window.location.href = `/quran/${surah}/${ayah + 1}`;
    }
  };
  const goPrev = () => {
    if (!isNaN(surah) && !isNaN(ayah)) {
      window.location.href = `/quran/${surah}/${ayah - 1}`;
    }
  };

// ========== دوال الصوت المحسنة ==========
  const playUrl = (url: string, errorMessage: string) => {
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => alert(errorMessage));
    }
  };

  const getAyahAudioUrl = (surah: number, ayah: number) => {
    // يجب أن تكون السورة والآية 3 أرقام: سورة 2 آية 1 = 002001
    const s = String(surah).padStart(3, '0');
    const a = String(ayah).padStart(3, '0');
    return `https://everyayah.com/data/Alafasy_128kbps/${s}${a}.mp3`;
  };

  const getWordAudioUrl = (surah: number, ayah: number, word: number) => {
    const s = String(surah).padStart(3, '0');
    const a = String(ayah).padStart(3, '0');
    const w = String(word).padStart(3, '0');
    // سيرفر الكلمات الصحيح
    return `https://words.audios.quranwbw.com/${surah}/${s}_${a}_${w}.mp3`;
  };
  
  const playAyahAudio = async () => {
    if (!isNaN(surah) && !isNaN(ayah)) {
      const url = getAyahAudioUrl(surah, ayah);
      playUrl(url, "عذراً، تعذر تحميل الآية.");
    }
  };

  const playWordAudio = (idx: number) => {
    if (!isNaN(surah) && !isNaN(ayah)) {
      const url = getWordAudioUrl(surah, ayah, idx + 1);
      playUrl(url, "عذراً، تعذر تحميل الكلمة.");
    }
  };

  const handleGoToAyah = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseInt(goToAyah, 10);
    if (a >= 1 && !isNaN(surah)) {
      window.location.href = `/quran/${surah}/${a}`;
    }
    setGoToAyah("");
  };

  const openHelp = (type: "type" | "position" | "sign") => {
    const texts = HELP_TEXTS[locale] || HELP_TEXTS.en;
    setHelpContent(texts[type]);
    setHelpDialogOpen(true);
  };

  const surahAyahTitle =
    locale === "ar"
      ? `سورة ${surah} - آية ${ayah}`
      : locale === "tr"
      ? `Sure ${surah} - Ayet ${ayah}`
      : `Surah ${surah} - Ayah ${ayah}`;

  if (isNaN(surah) || isNaN(ayah)) {
    return (
      <div className="text-center py-20 space-y-4">
        <h1 className="text-2xl font-bold text-destructive">رابط غير صالح</h1>
        <p className="text-muted-foreground">تأكد من رقم السورة والآية.</p>
        <Link href="/quran" className="text-primary hover:underline">العودة لفهرس السور</Link>
      </div>
    );
  }

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
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8" dir="rtl">
      <audio ref={audioRef} className="hidden" />

      {/* شريط التنقل العلوي */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={surah === 1 && ayah === 1}>
            <ChevronRight className="h-4 w-4 ml-1" /> <T>Previous</T>
          </Button>
          {ayah === 1 && surah > 1 && (
            <Link href={`/quran/${surah - 1}/1`} className="text-sm text-muted-foreground hover:underline self-center">
              <T>Previous Surah</T>
            </Link>
          )}
        </div>

        <div className="text-center flex-1">
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Arial, sans-serif" }}>
            {surahAyahTitle}
          </h2>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goNext}>
            <T>Next</T> <ChevronLeft className="h-4 w-4 mr-1" />
          </Button>
          {surah < 114 && (
            <Link href={`/quran/${surah + 1}/1`} className="text-sm text-primary hover:underline self-center">
              <T>Next Surah</T>
            </Link>
          )}
        </div>
      </div>

      {/* مربع الانتقال لآية */}
      <form onSubmit={handleGoToAyah} className="flex justify-center gap-2">
        <Input
          type="number"
          min={1}
          placeholder={ayah.toString()}
          value={goToAyah}
          onChange={(e) => setGoToAyah(e.target.value)}
          className="w-24 text-center"
        />
        <Button type="submit" variant="outline" size="sm"><T>Go</T></Button>
      </form>

      {/* أزرار التحكم (ترجمة، صوت، تفسير) */}
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowTranslation(!showTranslation)}>
          {showTranslation ? <T>Hide Translation</T> : <T>Show Translation</T>}
        </Button>
        <Button variant="ghost" size="sm" onClick={playAyahAudio}>
          <Volume2 className="h-4 w-4 ml-1" /> <T>Listen to Ayah</T>
        </Button>
        <Button variant="ghost" size="sm" onClick={loadTafsir}>
          <BookOpen className="h-4 w-4 ml-1" /> <T>Show Tafsir</T>
        </Button>
      </div>

      {/* عرض الآية */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div
          className="flex flex-wrap justify-center gap-3 text-3xl md:text-5xl leading-loose"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {words.map((w, i) => {
            const wordColor = getWordColor(w.word);
            const isSelected = selectedWordIdx === i;
            return (
              <button
                key={i}
                onClick={() => { setSelectedWordIdx(i === selectedWordIdx ? null : i); playWordAudio(i); }}
                className={`px-3 py-1.5 rounded-lg transition-all duration-300 hover:scale-110 ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  color: wordColor,
                  fontWeight: 700,
                  backgroundColor: `${wordColor}15`,
                  border: `2px solid ${wordColor}60`,
                  boxShadow: `0 0 12px ${wordColor}80, 0 4px 12px rgba(0,0,0,0.1)`,
                  textShadow: `0 0 8px ${wordColor}40`,
                  backdropFilter: 'blur(4px)',
                }}
              >
                {w.word}
              </button>
            );
          })}
        </div>
        {showTranslation && translation && (
          <div className="mt-4 text-sm text-muted-foreground text-center border-t pt-3" style={{ fontFamily: "Calibri, sans-serif" }}>
            {translation}
          </div>
        )}
      </div>

      {/* عرض التفسير */}
      {showTafsir && tafsir && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-foreground"><T>Tafsir</T></h3>
            <Button variant="ghost" size="sm" onClick={() => setShowTafsir(false)}><T>Close</T></Button>
          </div>
          <p className="text-sm leading-relaxed" style={{ fontFamily: "Calibri, sans-serif" }}>{tafsir}</p>
        </div>
      )}

      {/* جدول التحليل */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "Arial, sans-serif" }}>الكلمة</th>
                <th className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "Arial, sans-serif" }}>
                  تحليل النوع{" "}
                  <button onClick={() => openHelp("type")} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition">
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "Arial, sans-serif" }}>
                  الموقع الإعرابي{" "}
                  <button onClick={() => openHelp("position")} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition">
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-foreground" style={{ fontFamily: "Arial, sans-serif" }}>
                  العلامة الإعرابية{" "}
                  <button onClick={() => openHelp("sign")} className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition">
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {words.map((w, wordIdx) => {
                const wordColor = getWordColor(w.word);
                const isSelected = selectedWordIdx === wordIdx;
                return (
                  <tr
                    key={wordIdx}
                    onClick={() => setSelectedWordIdx(wordIdx === selectedWordIdx ? null : wordIdx)}
                    className={`border-b border-border cursor-pointer transition-all duration-300 ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full border-2" style={{ borderColor: wordColor, boxShadow: `0 0 8px ${wordColor}` }} />
                        <span className="text-xl font-bold" style={{ fontFamily: "Arial, sans-serif", color: wordColor }}>
                          {w.word}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        {w.components.map((comp, j) => (
                          <span
                            key={j}
                            className="inline-block px-3 py-1.5 rounded-lg text-sm border-2"
                            style={{ fontFamily: "Calibri, sans-serif", color: getWordColor(comp.text), borderColor: getWordColor(comp.text), backgroundColor: `${getWordColor(comp.text)}10` }}
                          >
                            {comp.type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        {w.components.map((comp, j) => (
                          <span
                            key={j}
                            className="inline-block px-3 py-1.5 rounded-lg text-sm border-2"
                            style={{ fontFamily: "Calibri, sans-serif", color: getWordColor(comp.text), borderColor: getWordColor(comp.text), backgroundColor: `${getWordColor(comp.text)}10` }}
                          >
                            {comp.position}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        {w.components.map((comp, j) => (
                          <span
                            key={j}
                            className="inline-block px-3 py-1.5 rounded-lg text-sm border-2"
                            style={{ fontFamily: "Calibri, sans-serif", color: getWordColor(comp.text), borderColor: getWordColor(comp.text), backgroundColor: `${getWordColor(comp.text)}10` }}
                          >
                            {comp.sign}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* فقاعة منبثقة للكلمة المحددة */}
      {selectedWordIdx !== null && words[selectedWordIdx] && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 scale-100">
          <div
            className="rounded-2xl border-2 p-5 shadow-2xl max-w-lg text-center bg-card"
            style={{ borderColor: getWordColor(words[selectedWordIdx].word) }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <span
                className="inline-block w-4 h-4 rounded-full border-2"
                style={{ borderColor: getWordColor(words[selectedWordIdx].word), boxShadow: `0 0 12px ${getWordColor(words[selectedWordIdx].word)}` }}
              />
              <h3 className="text-2xl font-bold" style={{ fontFamily: "Arial, sans-serif", color: getWordColor(words[selectedWordIdx].word) }}>
                {words[selectedWordIdx].word}
              </h3>
            </div>
            <div className="text-sm text-foreground leading-relaxed" style={{ fontFamily: "Calibri, sans-serif" }}>
              {words[selectedWordIdx].components.map((comp, i) => (
                <div key={i} className="mb-1" style={{ color: getWordColor(comp.text) }}>
                  {comp.text}: {comp.type} – {comp.position} – {comp.sign}
                </div>
              ))}
              {words[selectedWordIdx].meaning && (
                <p className="mt-2"><strong>المعنى:</strong> {words[selectedWordIdx].meaning}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSelectedWordIdx(null)}>
              <T>Close</T>
            </Button>
          </div>
        </div>
      )}

      {/* نافذة المساعدة */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl"><T>Explanation</T></DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed" style={{ fontFamily: "Calibri, sans-serif" }}>{helpContent}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}