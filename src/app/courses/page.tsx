"use client";

/**
 * CoursePage — Ruhulqudus Academy (v3)
 * خلفية سادة + بقع خضراء وذهبية شيك + Parallax scrolling
 * على الكمبيوتر: شريط البحث والإحصائيات جنب بعض
 */

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import { T } from "@/components/TranslatedText";
import { CategoryTabs } from "@/components/courses/CategoryTabs";
import { CourseCard } from "@/components/courses/CourseCard";
import TutorChat from "@/components/TutorChat";
import { usePathname } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  BookOpen,
  Users,
  Star,
  X,
  MessageCircle,
} from "lucide-react";

const PRIMARY = "var(--primary)";
const GOLD = "var(--gold)";

interface Category {
  id: string;
  name: string;
  slug: string;
}
interface Course {
  id: string;
  title: string;
  description?: string;
  instructor_name?: string;
  intro_video_url?: string;
  price: number;
  old_price?: number;
  launch_date?: string;
  course_duration?: string;
  lesson_duration?: string;
  level?: string;
  thumbnail_url?: string;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = (typeof LEVELS)[number];

export default function CoursePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<Level[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'en';
  const language = ['en', 'tr', 'it', 'es', 'ar'].includes(locale) ? locale : 'en';

  /* ── Parallax ── */
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const smooth = useSpring(scrollY, { stiffness: 120, damping: 30, mass: 0.4 });

  const blobA = useTransform(smooth, [0, 1200], [0, 260]);
  const blobB = useTransform(smooth, [0, 1200], [0, -200]);
  const blobC = useTransform(smooth, [0, 1600], [0, 340]);
  const gridY = useTransform(smooth, [0, 1200], [0, 90]);
  const heroY = useTransform(smooth, [0, 600], [0, 120]);
  const heroFade = useTransform(smooth, [0, 480], [1, 0]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeSlug) params.append("category", activeSlug);
    if (query) params.append("search", query);
    if (selectedLevels.length) params.append("levels", selectedLevels.join(","));

    const t = setTimeout(() => {
      fetch(`/api/course?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setCourses(d.course || []))
        .catch(() => setCourses([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [activeSlug, query, selectedLevels]);

  const toggleLevel = (l: Level) =>
    setSelectedLevels((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l],
    );

  const activeFilters = selectedLevels.length + (query ? 1 : 0);

  return (
    <div ref={pageRef} className="relative min-h-screen bg-background">
      {/* ─── خلفية سادة + بقع خضراء وذهبية بحركة parallax ─── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          style={{
            y: blobA,
            background: `radial-gradient(circle, ${PRIMARY}, transparent 70%)`,
          }}
          className="absolute -top-52 -right-40 h-[38rem] w-[38rem] rounded-full opacity-[0.22] blur-[150px]"
        />
        <motion.div
          style={{
            y: blobB,
            background: `radial-gradient(circle, ${GOLD}, transparent 70%)`,
          }}
          className="absolute top-[26rem] -left-48 h-[32rem] w-[32rem] rounded-full opacity-[0.16] blur-[160px]"
        />
        <motion.div
          style={{
            y: blobC,
            background: `radial-gradient(circle, ${PRIMARY}, transparent 72%)`,
          }}
          className="absolute bottom-[-10rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-[170px]"
        />
        <motion.div
          style={{ y: gridY }}
          className="absolute -inset-y-32 inset-x-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_0)] [background-size:30px_30px] opacity-40"
        />
      </div>

      {/* ─── Hero ─── */}
      <section className="relative py-20 md:py-28">
        <motion.div
          style={{ y: heroY, opacity: heroFade }}
          className="mx-auto max-w-7xl px-4 text-center md:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] backdrop-blur-md"
              style={{
                borderColor: `${PRIMARY}55`,
                color: PRIMARY,
                backgroundColor: `${PRIMARY}12`,
              }}
            >
              <Sparkles size={13} />
              <T>Ruhulqudus Academy</T>
            </span>

            <h1 className="mt-6 font-serif text-5xl font-bold leading-[1.08] tracking-tight text-foreground md:text-7xl">
              <T>Explore Our</T>{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${GOLD}, ${PRIMARY} 55%, ${GOLD})`,
                }}
              >
                <T>Courses</T>
              </span>
            </h1>

            <div className="mx-auto mt-6 flex items-center justify-center gap-3">
              <span
                className="h-px w-16"
                style={{ backgroundImage: `linear-gradient(90deg, transparent, ${GOLD}90)` }}
              />
              <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: PRIMARY }} />
              <span
                className="h-px w-16"
                style={{ backgroundImage: `linear-gradient(270deg, transparent, ${GOLD}90)` }}
              />
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              <T>
                Master the Arabic language and Quran with expertly crafted
                courses designed for every level.
              </T>
            </p>
          </motion.div>

          {/* ─── البحث + الإحصائيات جنب بعض على الكمبيوتر ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mx-auto mt-12 grid max-w-6xl grid-cols-1 items-start gap-5 text-start lg:grid-cols-[minmax(0,1fr)_auto]"
          >
            {/* Search */}
            <div className="w-full">
              <div
                className="relative rounded-full p-[1.5px]"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${GOLD}55, ${PRIMARY}88, ${GOLD}55)`,
                }}
              >
                <div className="relative rounded-full bg-card/80 backdrop-blur-xl">
                  <Search
                    className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2"
                    style={{ color: PRIMARY }}
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search courses..."
                    className="w-full rounded-full bg-transparent py-4 pl-14 pr-14 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    onClick={() => setShowFilters((s) => !s)}
                    aria-label="Filters"
                    className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition-all"
                    style={
                      showFilters
                        ? { backgroundColor: PRIMARY, color: "#fff" }
                        : { border: `1px solid ${PRIMARY}55`, color: PRIMARY }
                    }
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-3xl border border-border/50 bg-card/60 p-5 backdrop-blur-xl">
                      <p
                        className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                        style={{ color: PRIMARY }}
                      >
                        <T>Level</T>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {LEVELS.map((l) => {
                          const on = selectedLevels.includes(l);
                          return (
                            <button
                              key={l}
                              onClick={() => toggleLevel(l)}
                              className="rounded-full px-4 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5"
                              style={
                                on
                                  ? {
                                      backgroundColor: PRIMARY,
                                      color: "#fff",
                                      boxShadow: `0 8px 20px -8px ${PRIMARY}`,
                                    }
                                  : {
                                      border:
                                        "1px solid color-mix(in oklab, var(--border) 80%, transparent)",
                                      color: "var(--foreground)",
                                    }
                              }
                            >
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {activeFilters > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {query && (
                    <Chip label={`"${query}"`} onClear={() => setQuery("")} />
                  )}
                  {selectedLevels.map((l) => (
                    <Chip key={l} label={l} onClear={() => toggleLevel(l)} />
                  ))}
                  <button
                    onClick={() => {
                      setQuery("");
                      setSelectedLevels([]);
                    }}
                    className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline"
                  >
                    <T>Clear all</T>
                  </button>
                </div>
              )}
            </div>

            {/* Stats — جنب البحث على الشاشات الكبيرة */}
          </motion.div>
        </motion.div>
      </section>

      {/* ─── الكورسات ─── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <div className="lg:flex lg:items-start lg:gap-10">
          <CategoryTabs
            categories={categories}
            activeSlug={activeSlug}
            onSelect={setActiveSlug}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {loading ? (
                  <T>Loading courses…</T>
                ) : (
                  <>
                    <span className="font-bold text-foreground">
                      {courses.length}
                    </span>{" "}
                    <T>courses available</T>
                  </>
                )}
              </p>
              <span
                className="hidden h-px flex-1 sm:block"
                style={{
                  backgroundImage: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)`,
                }}
              />
            </div>

            {loading ? (
              <div className="grid gap-[6px] sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[420px] animate-pulse rounded-3xl border border-border/40 bg-card/40 backdrop-blur-md"
                  />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-border/50 bg-card/50 py-20 text-center backdrop-blur-xl"
              >
                <div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${PRIMARY}18`, color: PRIMARY }}
                >
                  <Search className="h-7 w-7" />
                </div>
                <h2 className="mt-5 font-serif text-2xl font-bold text-foreground">
                  <T>No courses found</T>
                </h2>
                <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                  <T>
                    Try adjusting your filters or check back later for new
                    courses.
                  </T>
                </p>
                {activeFilters > 0 && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setSelectedLevels([]);
                    }}
                    className="mt-6 rounded-full px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.03]"
                    style={{
                      backgroundImage: `linear-gradient(120deg, ${PRIMARY}, ${GOLD})`,
                    }}
                  >
                    <T>Clear filters</T>
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="grid gap-[6px] sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 36 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{
                      duration: 0.55,
                      delay: (i % 3) * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <CourseCard course={course} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── زر المعلم الذكي العائم ─── */}
      <button
        onClick={() => setChatOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '64px',
          height: '64px',
          borderRadius: '9999px',
          backgroundImage: `linear-gradient(135deg, ${PRIMARY}, ${GOLD})`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          border: 'none',
        }}
        aria-label="Chat with Arabic teacher"
      >
        <MessageCircle className="h-7 w-7" />
      </button>

      {/* ─── نافذة المعلم الذكي ─── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setChatOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '42rem',
                maxHeight: '85vh',
                overflowY: 'auto',
                borderRadius: '1.5rem',
                background: 'var(--background)',
                boxShadow: '0 25px 60px -15px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  zIndex: 10,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-label="Close chat"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
              <TutorChat context="sales" language={language} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{
        backgroundColor: `${PRIMARY}14`,
        color: PRIMARY,
        border: `1px solid ${PRIMARY}40`,
      }}
    >
      {label}
      <button onClick={onClear} aria-label="Remove filter">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}