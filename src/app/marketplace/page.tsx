"use client";
import { useEffect, useState } from "react";
import { T } from "@/components/TranslatedText";
import { CategoryTabs } from "@/components/marketplace/CategoryTabs";
import { CourseCard } from "@/components/marketplace/CourseCard";
import { Loader2 } from "lucide-react";

interface Category { id: string; name: string; slug: string; }
interface Course {
  id: string; title: string; description?: string; instructor_name?: string;
  intro_video_url?: string; price: number; launch_date?: string;
  course_duration?: string; lesson_duration?: string;
}

export default function MarketplacePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(d => setCategories(d.categories || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = activeSlug ? `?category=${activeSlug}` : "";
    fetch(`/api/courses${params}`)
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .finally(() => setLoading(false));
  }, [activeSlug]);

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <h1 className="font-serif text-4xl text-foreground mb-8 text-center"><T>استكشف الكورسات</T></h1>
        <CategoryTabs categories={categories} activeSlug={activeSlug} onSelect={setActiveSlug} />
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground"><T>لا توجد كورسات حالياً</T></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (<CourseCard key={course.id} course={course} />))}
          </div>
        )}
      </div>
    </div>
  );
}