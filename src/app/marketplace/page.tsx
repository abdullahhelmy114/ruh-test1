"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { CategoryTabs } from "@/components/marketplace/CategoryTabs";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category { id: string; name: string; slug: string; }
interface Course {
  id: string; title: string; description?: string; instructor_name?: string;
  intro_video_url?: string; price: number; old_price?: number; launch_date?: string;
  course_duration?: string; lesson_duration?: string; level?: string; thumbnail_url?: string;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = (typeof LEVELS)[number];

export default function MarketplacePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<Level[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeSlug) params.append("category", activeSlug);
    if (query) params.append("search", query);
    if (selectedLevels.length) params.append("levels", selectedLevels.join(","));

    fetch(`/api/courses?${params.toString()}`)
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .finally(() => setLoading(false));
  }, [activeSlug, query, selectedLevels]);

  const toggleLevel = (l: Level) => setSelectedLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent mb-4">
              <Sparkles size={14} />
              <T>Ruhulqudus Academy</T>
            </div>
            <h1 className="font-serif text-4xl md:text-6xl font-bold text-foreground">
              <T>Explore Our Courses</T>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              <T>Master the Arabic language and Quran with expertly crafted courses designed for every level.</T>
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mt-10 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-accent" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search courses..."
                className="w-full rounded-full border border-border/50 bg-card/50 py-3.5 pl-14 pr-12 text-sm text-foreground backdrop-blur-md outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent/60"
              />
              <button
                onClick={() => setShowFilters(s => !s)}
                className={cn("absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors", showFilters ? "bg-accent text-accent-foreground" : "border border-accent/40 text-accent hover:bg-accent/10")}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-3 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-md">
                    <p className="mb-3 text-xs uppercase tracking-widest text-accent font-semibold"><T>Level</T></p>
                    <div className="flex flex-wrap gap-2">
                      {LEVELS.map(l => (
                        <button key={l} onClick={() => toggleLevel(l)} className={cn("rounded-full px-4 py-2 text-xs font-medium transition-colors", selectedLevels.includes(l) ? "bg-accent text-accent-foreground" : "border border-border/60 bg-background/40 text-foreground hover:border-accent/50")}>{l}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
        <div className="lg:flex lg:items-start lg:gap-10">
          <CategoryTabs categories={categories} activeSlug={activeSlug} onSelect={setActiveSlug} />
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>
            ) : courses.length === 0 ? (
              <div className="py-20 text-center">
                <h2 className="font-serif text-2xl text-foreground mb-2"><T>No courses found</T></h2>
                <p className="text-muted-foreground"><T>Try adjusting your filters or check back later for new courses.</T></p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map(course => (<CourseCard key={course.id} course={course} />))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}