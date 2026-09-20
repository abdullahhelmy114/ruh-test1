"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  Users,
  BookOpen,
  Sparkles,
  Shield,
  Globe,
  GraduationCap,
  Heart,
  MessageCircle,
  Calendar,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { T } from "@/components/TranslatedText";

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6 },
};

/** A published academy course as the public catalog returns it (no price, level or teacher: the catalog does not publish them). */
interface CatalogCourse {
  slug: string;
  title: string;
  description: string | null;
  program: { slug: string; title: string } | null;
}

/** The academy catalog, the one public list of courses. */
const CATALOG_API = "/api/public/academy/catalog";
const FEATURED_COUNT = 3;

export default function HomePage() {
  // null while loading; "unavailable" when the catalog could not be read (nothing is claimed about it then).
  const [featuredCourses, setFeaturedCourses] = useState<CatalogCourse[] | "unavailable" | null>(null);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [certification, setCertification] = useState<any>(null);
  const [stats, setStats] = useState({
    experience: "30+",
  });

  useEffect(() => {
    // Fetch real stats (example: from an API or static)
    // يمكن استبدالها بقيم حقيقية من /api/stats إذا وُجدت
    // تركناها ثابتة كمثال

    // Featured courses: the first published academy courses.
    fetch(CATALOG_API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const courses: unknown = d?.data?.courses;
        setFeaturedCourses(Array.isArray(courses) ? (courses as CatalogCourse[]).slice(0, FEATURED_COUNT) : "unavailable");
      })
      .catch(() => setFeaturedCourses("unavailable"));

    // Certification Info
    fetch("/api/certification")
      .then((r) => r.json())
      .then((d) => setCertification(d))
      .catch(() => {});
  }, []);

  return (
    <div className="overflow-hidden">
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
  {/* البقع الكبيرة الحالية */}
  <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
  <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

  {/* بقع برتقالية خفيفة إضافية */}
  <div className="absolute left-[8%] top-[18%] h-24 w-24 rounded-full bg-orange-200/30 blur-xl" />
  <div className="absolute right-[12%] top-[32%] h-32 w-32 rounded-full bg-orange-300/20 blur-xl" />
  <div className="absolute left-[22%] bottom-[20%] h-28 w-28 rounded-full bg-amber-200/30 blur-lg" />
  <div className="absolute right-[28%] bottom-[10%] h-20 w-20 rounded-full bg-orange-200/40 blur-md" />
  <div className="absolute left-[45%] top-[55%] h-16 w-16 rounded-full bg-orange-100/40 blur-md" />
</div>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-8 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="text-xs uppercase tracking-[0.3em] text-gold ornament">
              <T>Founder: Dr. Jehan Ali Ziad</T>
            </div>

            <h1 className="mt-5 font-serif text-5xl leading-[1.05] md:text-7xl">
              <T>The art of</T> <em className="text-gold">Arabic</em>,
              <br />
              <T>taught with reverence.</T>
            </h1>

            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              <T>
                An elite academy for those who seek mastery of the Arabic
                language — classical, modern, and Quranic — through live
                mentorship and timeless curriculum.
              </T>
            </p>

{/* An early-bird form here promised a launch discount and confirmed it to the visitor while
    storing nothing. Places are sold per class group through the academy catalogue, so the
    invitation points there instead of collecting an address that nothing reads. */}
<div className="mt-8 max-w-md">
  <Link
    href="/academy"
    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02]"
  >
    <T>See the courses</T> <ChevronRight className="h-4 w-4" />
  </Link>
</div>



<div className="mt-10 grid grid-cols-2 gap-6 border-t pt-6">
  <div>
    <div className="font-serif text-2xl text-gold">{stats.experience}</div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">
      <T>Years Academic Experience</T>
    </div>
  </div>
  <div>
    <div className="font-serif text-2xl text-gold">100%</div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">
      <T>Live Online Mentorship</T>
    </div>
  </div>
</div>

          </motion.div>

<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.8, delay: 0.2 }}
  className="relative"
>
  {/* الظل: أخضر في الوضع الفاتح، ذهبي في الوضع الداكن */}
  <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/20 dark:bg-gold/20 blur-2xl" />
  <div className="relative overflow-hidden rounded-[2.5rem] gradient-hero dark:bg-[#f5e9dc] dark:bg-none p-10 text-primary-foreground dark:text-[#17352c] shadow-elegant">
    <div
      className="font-arabic text-right text-7xl leading-tight"
      style={{ fontFamily: "Amiri, serif" }}
    >
      ٱقْرَأْ
    </div>
    <div className="mt-2 text-right text-sm text-gold dark:text-[#17352c]">
      <T>Read</T> · <T>The first command</T>
    </div>

    <div className="mt-10 space-y-4">
      {[
        { icon: <Award className="h-4 w-4" />, t: "Certified Teacher Program" },
        { icon: <Users className="h-4 w-4" />, t: "Live Cohorts via Zoom" },
        { icon: <BookOpen className="h-4 w-4" />, t: "A1 — C2 Curriculum" },
      ].map((f) => (
        <div
          key={f.t}
          className="flex items-center gap-3 rounded-2xl bg-white/5 dark:bg-black/10 backdrop-blur p-3"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-gold-foreground">
            {f.icon}
          </div>
          <span className="text-sm">
            <T>{f.t}</T>
          </span>
        </div>
      ))}
    </div>
  </div>
</motion.div>
        </div>
      </section>

      {/* ─── Pillars ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-gold ornament">
            <T>The Academy</T>
          </div>
          <h2 className="mt-3 font-serif text-4xl">
            <T>Three pillars of mastery</T>
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { t: "Curriculum", d: "Built on classical pedagogy and modern linguistic science.", i: <BookOpen /> },
            { t: "Mentorship", d: "Live guidance from certified scholars in intimate cohorts.", i: <Users /> },
            { t: "Certification", d: "Earn recognized credentials to teach the Arabic language.", i: <Award /> },
          ].map((p, i) => (
            <motion.div
              key={p.t}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-3xl border bg-card p-8 shadow-elegant"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-emerald text-primary-foreground">
                {p.i}
              </div>
              <h3 className="mt-5 font-serif text-2xl">
                <T>{p.t}</T>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <T>{p.d}</T>
              </p>
            </motion.div>
          ))}
        </div>
      </section>


      {/* ─── Pre-launch Preview Video ────────────────────── */}
      <section className="bg-accent/40 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <motion.div {...fadeInUp}>
              <div className="text-xs uppercase tracking-[0.3em] text-gold ornament">
                <T>Exclusive Sneak Peek</T>
              </div>
              <h2 className="mt-3 font-serif text-4xl">
                <T>Behind the scenes of Ruh-Ul-Qudus</T>
              </h2>
              <p className="mt-4 text-muted-foreground">
                <T>
                  See how our digital environment blends seamlessly with elite traditional scholarship. Watch a short preview of our live Zoom structure, dynamic dashboard, and interactive vocabulary engine.
                </T>
              </p>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Shield className="text-gold h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium"><T>No credit card required for early access</T></span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="text-gold h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium"><T>Get notified 24 hours before public opening</T></span>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              {...fadeInUp}
              className="relative aspect-video overflow-hidden rounded-[2rem] border bg-card shadow-elegant group cursor-pointer"
            >
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition group-hover:bg-black/50">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-primary shadow-elegant transition group-hover:scale-110">
                  <ChevronRight className="h-6 w-6 ml-1" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 text-xs font-semibold uppercase tracking-wider text-white bg-black/30 backdrop-blur px-3 py-1.5 rounded-full">
                <T>Preview Course Dashboard (1:20)</T>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ─── Academy courses (the public academy catalog) ──────────────── */}
      {/* Nothing is shown while the catalog loads; an empty catalog says so; a catalog that could not be read claims nothing and only offers the catalog page. */}
      {featuredCourses !== null && (
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <motion.div {...fadeInUp} className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
                <T>Academy courses</T>
              </div>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl">
                <T>Start your Arabic journey</T>
              </h2>
            </motion.div>

            {Array.isArray(featuredCourses) && featuredCourses.length > 0 && (
              <div className="mt-12 grid gap-6 md:grid-cols-3">
                {featuredCourses.map((course, i) => (
                  <motion.div
                    key={course.slug}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="group flex flex-col overflow-hidden rounded-3xl border bg-card shadow-elegant transition-all hover:-translate-y-1 hover:shadow-elegant"
                  >
                    <Link href={`/academy/courses/${encodeURIComponent(course.slug)}`}>
                      <div className="h-40 bg-linear-to-br from-primary to-primary/80 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-primary-foreground/30" />
                      </div>
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      <Link href={`/academy/courses/${encodeURIComponent(course.slug)}`}>
                        <h3 className="font-serif text-lg font-semibold hover:text-accent-foreground transition-colors line-clamp-1">
                          {course.title}
                        </h3>
                      </Link>
                      {course.program && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <T>Part of</T> {course.program.title}
                        </p>
                      )}
                      {course.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{course.description}</p>
                      )}
                      <div className="mt-auto pt-4">
                        <Link
                          href={`/academy/courses/${encodeURIComponent(course.slug)}`}
                          className="inline-flex rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition"
                        >
                          <T>View course</T>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {Array.isArray(featuredCourses) && featuredCourses.length === 0 && (
              <p role="status" className="mx-auto mt-10 max-w-xl text-center text-muted-foreground">
                <T>No courses are open yet. Please check back soon.</T>
              </p>
            )}

            <div className="mt-10 text-center">
              <Link
                href="/academy"
                className="inline-flex items-center gap-2 rounded-full border-2 border-primary/50 px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-primary/10 transition"
              >
                <T>View all courses</T> <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── Certification Section ─────────────────────── */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <motion.div {...fadeInUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
              <T>Certification</T>
            </div>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              <T>Become a certified Arabic teacher</T>
            </h2>
          </motion.div>

          <div className="mt-12 flex flex-col md:flex-row items-center gap-10">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex-1"
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: <ScrollText className="h-6 w-6" />, text: "Internationally Recognized" },
                  { icon: <Shield className="h-6 w-6" />, text: "Trusted by Institutions" },
                  { icon: <Globe className="h-6 w-6" />, text: "Global Community" },
                  { icon: <Award className="h-6 w-6" />, text: "Prestigious Credential" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-elegant"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                      {item.icon}
                    </div>
                    <span className="text-sm font-medium">
                      <T>{item.text}</T>
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex-1 text-center"
            >
              <div className="inline-block rounded-3xl border-2 border-primary/30 bg-card p-8 shadow-elegant">
                <GraduationCap className="mx-auto h-16 w-16 text-secondary-foreground" />
                <h3 className="mt-4 font-serif text-2xl font-bold">
                  <T>Your Path to Certification</T>
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {certification?.description || (
                    <T>
                      Complete our program and earn a certificate to teach
                      Arabic anywhere in the world.
                    </T>
                  )}
                </p>
                <Link
                  href="/certification"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-elegant hover:bg-accent/90 transition"
                >
                  <T>Explore certification</T> <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Latest Blog Posts ──────────────────────────── */}
      {blogPosts.length > 0 && (
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <motion.div {...fadeInUp} className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
                <T>From Our Blog</T>
              </div>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl">
                <T>Tips, news & inspiration</T>
              </h2>
            </motion.div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {blogPosts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group overflow-hidden rounded-3xl border bg-card shadow-elegant transition-all hover:-translate-y-1 hover:shadow-elegant"
                >
                  {post.image_url && (
                    <div className="h-40 relative overflow-hidden">
                      <Image
                        src={post.image_url}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(post.created_at).toLocaleDateString()}
                      <span className="flex items-center gap-1 ml-auto">
                        <Heart className="h-3.5 w-3.5" /> {post.likes_count}
                        <MessageCircle className="h-3.5 w-3.5 ml-2" />{" "}
                        {post.comments_count}
                      </span>
                    </div>
                    <Link href={`/blog/${post.id}`}>
                      <h3 className="mt-2 font-serif text-lg font-semibold hover:text-accent-foreground transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                    </Link>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {post.excerpt}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 rounded-full border-2 border-primary/50 px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-primary/10 transition"
              >
                <T>Read More Posts</T> <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}