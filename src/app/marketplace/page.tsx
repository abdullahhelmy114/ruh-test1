"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { CategoryTabs } from "@/components/marketplace/CategoryTabs";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { Loader2, Search, SlidersHorizontal, BookOpen, Sparkles } from "lucide-react";

interface Category { id: string; name: string; slug: string; }
interface Course {
  id: string; title: string; description?: string; instructor_name?: string;
  intro_video_url?: string; price: number; launch_date?: string;
  course_duration?: string; lesson_duration?: string;
  level?: string;
}

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function MarketplacePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(d => setCategories(d.categories || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeSlug) params.append("category", activeSlug);
    if (search) params.append("search", search);
    if (selectedLevel) params.append("level", selectedLevel);

    fetch(`/api/courses?${params.toString()}`)
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .finally(() => setLoading(false));
  }, [activeSlug, search, selectedLevel]);

  const clearFilters = () => {
    setSearch("");
    setSelectedLevel("");
  };

  const hasActiveFilters = search || selectedLevel;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
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

          {/* Search & Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 max-w-3xl mx-auto"
          >
            <div className="glass rounded-2xl p-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search courses..."
                  className="w-full rounded-xl bg-transparent pl-12 pr-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-xl transition-colors ${showFilters ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-muted-foreground'}`}
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>

            {/* Expanded Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass mt-2 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground"><T>Level:</T></span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedLevel("")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedLevel ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                      >
                        <T>All</T>
                      </button>
                      {levels.map(l => (
                        <button
                          key={l}
                          onClick={() => setSelectedLevel(l)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedLevel === l ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      >
                        <T>Clear Filters</T>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Categories & Courses */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
        <CategoryTabs categories={categories} activeSlug={activeSlug} onSelect={setActiveSlug} />

        {/* Results count */}
        {!loading && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {courses.length > 0 ? (
                <T>{`Showing ${courses.length} course${courses.length > 1 ? 's' : ''}`}</T>
              ) : (
                <T>No courses found</T>
              )}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-accent hover:underline">
                <T>Clear all filters</T>
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary h-10 w-10" />
          </div>
        ) : courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              <T>No courses available</T>
            </h3>
            <p className="text-muted-foreground">
              <T>Try adjusting your filters or check back later for new courses.</T>
            </p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <CourseCard course={course} />
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}