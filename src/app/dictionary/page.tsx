'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchBar } from '@/components/dictionary/SearchBar';
import { AlphabetIndex } from '@/components/dictionary/AlphabetIndex';
import { WordTable } from '@/components/dictionary/WordTable';
import { AdvancedWordView } from '@/components/dictionary/AdvancedWordView';
import { ViewToggle } from '@/components/dictionary/ViewToggle';
import { LanguageToggle } from '@/components/dictionary/LanguageToggle';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation, T } from '@/lib/translation';
import { DictionaryEntry, QuranAnalysis, ViewMode } from '@/types';

const FlipBook3D = dynamic(() => import('@/components/dictionary/FlipBook3D'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-12">
      <Spinner className="h-8 w-8" />
    </div>
  ),
});

const ARABIC_LETTERS = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
];

const SURAH_NAMES = [
  'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس',
  'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه',
  'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم',
  'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
  'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
  'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة',
  'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
  'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
  'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد',
  'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات',
  'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر',
  'المسد', 'الإخلاص', 'الفلق', 'الناس'
];

function LetterPage({ letter }: { letter: string }) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLetterEntries() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/words?letter=${encodeURIComponent(letter)}`);
        if (!res.ok) throw new Error('Failed to fetch entries');
        const data: DictionaryEntry[] = await res.json();
        if (!cancelled) setEntries(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLetterEntries();
    return () => { cancelled = true; };
  }, [letter]);

  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-3xl font-bold mb-4 text-center">{letter}</h2>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground"><T>No words found</T></p>
      ) : (
        <WordTable entries={entries} />
      )}
    </div>
  );
}

function IrabViewer({ analyses, loading }: { analyses: QuranAnalysis[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>;
  if (analyses.length === 0) return <p className="text-center text-muted-foreground"><T>No irab found</T></p>;

  return (
    <div className="space-y-6">
      {analyses.map((analysis) => (
        <div key={analysis.id} className="border rounded-lg p-6 bg-background shadow-elegant">
          <div className="mb-4 text-center">
            <h3 className="text-2xl font-bold mb-2">{analysis.ayah_text}</h3>
            <p className="text-sm text-muted-foreground">
              {SURAH_NAMES[analysis.surah_number - 1]} — الآيات: {analysis.ayah_numbers.join('، ')}
            </p>
          </div>
          {analysis.irab && (
            <div>
              <h4 className="text-lg font-semibold mb-2"><T>Irab</T></h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analysis.irab_words.map((w, idx) => (
                  <div key={idx} className="flex gap-2 p-2 rounded bg-muted/30">
                    <span className="font-bold whitespace-nowrap">{w.word}</span>
                    <span className="text-muted-foreground text-sm">{w.analysis}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.sarf && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-2"><T>Sarf</T></h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysis.sarf}</p>
            </div>
          )}
          {analysis.balagha && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-2"><T>Balagha</T></h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysis.balagha}</p>
            </div>
          )}
          {analysis.fawaid && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-2"><T>Fawaid</T></h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysis.fawaid}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DictionaryPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'dictionary' | 'irab'>('dictionary');
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // حالة الإعراب
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [selectedAyah, setSelectedAyah] = useState<number | ''>('');
  const [irabSearchWord, setIrabSearchWord] = useState('');
  const [irabAnalyses, setIrabAnalyses] = useState<QuranAnalysis[]>([]);
  const [loadingIrab, setLoadingIrab] = useState(false);

  // جلب المعجم
  const fetchEntries = useCallback(async (letter: string | null, query: string) => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams();
      if (letter) params.set('letter', letter);
      if (query) params.set('q', query);
      const res = await fetch(`/api/words?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data: DictionaryEntry[] = await res.json();
      setEntries(data);
      setSuggestions(data.map(e => e.word));
    } catch (error) {
      console.error('Error fetching entries:', error);
      setEntries([]);
      setSuggestions([]);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dictionary') {
      fetchEntries(selectedLetter, searchQuery);
    }
  }, [selectedLetter, searchQuery, fetchEntries, activeTab]);

  // جلب الإعراب
  const fetchIrab = useCallback(async (surah: number, ayah: number | '', word: string) => {
    setLoadingIrab(true);
    try {
      const params = new URLSearchParams();
      if (word) {
        params.set('word', word);
      } else {
        params.set('surah', String(surah));
        if (ayah !== '') params.set('ayah', String(ayah));
      }
      const res = await fetch(`/api/irab?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch irab');
      const data = await res.json();
      setIrabAnalyses(data.analyses || []);
    } catch (error) {
      console.error('Error fetching irab:', error);
      setIrabAnalyses([]);
    } finally {
      setLoadingIrab(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'irab') {
      fetchIrab(selectedSurah, selectedAyah, irabSearchWord);
    }
  }, [selectedSurah, selectedAyah, irabSearchWord, activeTab, fetchIrab]);

  const handleSearch = (query: string) => setSearchQuery(query);
  const handleLetterSelect = (letter: string | null) => {
    setSelectedLetter(letter);
    setSearchQuery('');
  };

  const showIrabForWord = (word: string) => {
    setActiveTab('irab');
    setIrabSearchWord(word);
    setSelectedAyah('');
  };

  // عرض المعجم
  const renderDictionaryView = () => {
    if (viewMode === 'simple') {
      if (searchQuery || selectedLetter) {
        if (loadingEntries) return <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>;
        return <WordTable entries={entries} />;
      }
      const pages = ARABIC_LETTERS.map((letter) => (
        <LetterPage key={letter} letter={letter} />
      ));
      return <FlipBook3D pages={pages} />;
    } else {
      if (selectedEntry) {
        return <AdvancedWordView entry={selectedEntry} onShowIrab={() => showIrabForWord(selectedEntry.word)} />;
      }
      if (loadingEntries) return <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>;
      if (entries.length === 0) return <p className="text-center text-muted-foreground"><T>No words found</T></p>;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className="p-4 bg-background border rounded-lg hover:bg-accent transition-colors text-center relative"
            >
              <span className="block text-xl font-bold">{entry.word}</span>
              <span className="text-sm text-muted-foreground">{entry.word_type || entry.root}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showIrabForWord(entry.word);
                }}
                className="absolute top-2 left-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded px-2 py-1"
              >
                <T>Irab</T>
              </button>
            </button>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* الرأس والتبويبات */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">
            <T>Dictionary</T>
          </h1>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ViewToggle currentMode={viewMode} onToggle={setViewMode} />
          </div>
        </div>
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`px-4 py-2 font-medium ${activeTab === 'dictionary' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            <T>Dictionary</T>
          </button>
          <button
            onClick={() => setActiveTab('irab')}
            className={`px-4 py-2 font-medium ${activeTab === 'irab' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            <T>Irab</T>
          </button>
        </div>
      </div>

      {activeTab === 'dictionary' ? (
        <>
          <SearchBar onSearch={handleSearch} suggestions={suggestions} loading={loadingEntries} />
          {viewMode === 'simple' && (
            <AlphabetIndex selectedLetter={selectedLetter} onLetterSelect={handleLetterSelect} />
          )}
          <div className="mt-6">
            {renderDictionaryView()}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1"><T>Search word</T></label>
              <input
                type="text"
                value={irabSearchWord}
                onChange={(e) => {
                  setIrabSearchWord(e.target.value);
                  setSelectedAyah('');
                }}
                placeholder={t('Enter word')}
                className="w-full p-2 rounded border border-input bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1"><T>Surah</T></label>
              <select
                value={selectedSurah}
                onChange={(e) => setSelectedSurah(Number(e.target.value))}
                className="w-full p-2 rounded border border-input bg-background"
              >
                {SURAH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{idx + 1}. {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1"><T>Ayah</T></label>
              <input
                type="number"
                min="1"
                value={selectedAyah}
                onChange={(e) => setSelectedAyah(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={t('All')}
                className="w-full p-2 rounded border border-input bg-background"
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <IrabViewer analyses={irabAnalyses} loading={loadingIrab} />
          </div>
        </div>
      )}

      {/* تذييل المصادر */}
      <footer className="mt-10 pt-4 border-t border-border/30 text-center text-xs text-muted-foreground opacity-60">
        <p>
          <T>Data from Wiktionary (CC BY-SA 3.0)</T>
          {" · "}
          <T>Quran audio from EveryAyah.com</T>
        </p>
      </footer>
    </div>
  );
}