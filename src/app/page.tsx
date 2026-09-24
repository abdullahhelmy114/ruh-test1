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
  GraduationCap,
  Heart,
  MessageCircle,
  Calendar,
  ChevronRight,
  ScrollText,
  Target,
  Video,
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
  useEffect(() => {
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

            <h1 className="mt-5 font-serif text-5xl leading-[1.1] md:text-7xl">
              <T>home.hero.h1a</T>
              <em className="text-gold">
                <T>home.hero.h1b</T>
              </em>
              <T>home.hero.h1c</T>
            </h1>

            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              <T>home.hero.sub</T>
            </p>

{/* An early-bird form here promised a launch discount and confirmed it to the visitor while
    storing nothing. Places are sold per class group through the academy catalogue, so the
    invitation points there instead of collecting an address that nothing reads. */}
<div className="mt-8 max-w-md">
  <Link
    href="/academy"
    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02]"
  >
    <T>home.hero.cta</T> <ChevronRight className="h-4 w-4" />
  </Link>
</div>



{/* Two figures the codebase itself can vouch for: the trilingual product and
    the locked one-local-week Lesson Sheet release rule. The earlier "30+" and
    "100%" figures await the owner's substantiation and are recorded as pending. */}
<div className="mt-10 grid grid-cols-2 gap-6 border-t pt-6">
  <div>
    <div className="font-serif text-2xl text-gold">3</div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">
      <T>home.hero.stat1Label</T>
    </div>
  </div>
  <div>
    <div className="font-serif text-2xl text-gold">
      <T>home.hero.stat2</T>
    </div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">
      <T>home.hero.stat2Label</T>
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

    {/* The three statements the owner chose for this card, worded to what the
        product verifiably does today. The remedial engine is rule-based and
        teacher-overseen, so the line claims no AI; the teachers line claims the
        vetted approval the application pipeline enforces, not "expertise"; the
        third slot keeps the standing curriculum statement while the certificate
        wording awaits the owner (issuance is disabled by policy). */}
    <div className="mt-6 h-px bg-primary-foreground/25 dark:bg-[#17352c]/20" />
    <div className="mt-6 space-y-4">
      {[
        { icon: <Target className="h-4 w-4" />, t: "home.card.row1" },
        { icon: <Video className="h-4 w-4" />, t: "home.card.row2" },
        { icon: <BookOpen className="h-4 w-4" />, t: "A1 — C2 Curriculum" },
      ].map((f) => (
        <div
          key={f.t}
          className="flex items-center gap-3 rounded-2xl bg-white/5 dark:bg-black/10 backdrop-blur p-3"
        >
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gold text-gold-foreground">
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
          {/* The earlier bodies claimed "certified scholars" and "recognized
              credentials" — neither is in the verified register. These state
              only what the product's own pipeline supports. */}
          {[
            { t: "Curriculum", d: "home.pillars.p1", i: <BookOpen /> },
            { t: "Mentorship", d: "home.pillars.p2", i: <Users /> },
            { t: "Certification", d: "home.pillars.p3", i: <Award /> },
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


      {/* ─── The learning journey ─────────────────────────
          New content section (owner-approved V10): the week's fixed rhythm as
          the platform actually enforces it — Lesson Sheet release one local
          week ahead (locked rule), the scheduled live class, engine-graded
          objective work with human review for the rest, and policy-governed
          release with rule-based remedial assignment. Every sentence here is
          backed by the shipped code, not by marketing. */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <motion.div {...fadeInUp} className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-gold ornament">
            <T>home.journey.eyebrow</T>
          </div>
          <h2 className="mt-3 font-serif text-4xl">
            <T>home.journey.h2</T>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            <T>home.journey.intro</T>
          </p>
        </motion.div>

        <div className="relative mt-12">
          <div className="absolute inset-x-0 top-2 hidden h-px bg-border md:block" aria-hidden />
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { w: "home.journey.s1w", t: "home.journey.s1t", d: "home.journey.s1b" },
              { w: "home.journey.s2w", t: "home.journey.s2t", d: "home.journey.s2b" },
              { w: "home.journey.s3w", t: "home.journey.s3t", d: "home.journey.s3b" },
              { w: "home.journey.s4w", t: "home.journey.s4t", d: "home.journey.s4b" },
            ].map((s, i) => (
              <motion.div
                key={s.t}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="relative md:pt-8"
              >
                <span
                  className="absolute start-0 top-0 hidden h-4 w-4 rounded-full border border-gold bg-gold md:block"
                  aria-hidden
                />
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-gold">
                  <T>{s.w}</T>
                </div>
                <h3 className="mt-2 font-serif text-xl">
                  <T>{s.t}</T>
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  <T>{s.d}</T>
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/academy"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-elegant hover:bg-accent/90 transition"
          >
            <T>home.journey.cta</T> <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>


      {/* ─── Live classes ────────────────────── */}
      <section className="bg-accent/40 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <motion.div {...fadeInUp}>
              <div className="text-xs uppercase tracking-[0.3em] text-gold ornament">
                <T>home.live.eyebrow</T>
              </div>
              <h2 className="mt-3 font-serif text-4xl">
                <T>home.live.h2</T>
              </h2>
              <p className="mt-4 text-muted-foreground">
                <T>home.live.body</T>
              </p>
              {/* The earlier bullets promised an early-access list and a launch
                  notification that no mechanism behind this page provides. These
                  two state what the teacher-application pipeline and the class
                  group model actually enforce. */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Shield className="text-gold h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium"><T>home.live.b1</T></span>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="text-gold h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium"><T>home.live.b2</T></span>
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
                <T>home.live.player</T>
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
                <T>home.catalog.h2</T>
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
              <T>home.cert.h2</T>
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
              {/* The four earlier badges asserted external recognition the
                  register does not support ("Internationally Recognized",
                  "Trusted by Institutions", "Prestigious Credential"). These
                  four describe the certificate system the code actually
                  implements: academy-issued, requirement-based, verifiable by
                  a unique code, taught by vetted teachers. */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: <Award className="h-6 w-6" />, text: "home.cert.c1" },
                  { icon: <BookOpen className="h-6 w-6" />, text: "home.cert.c2" },
                  { icon: <ScrollText className="h-6 w-6" />, text: "home.cert.c3" },
                  { icon: <Shield className="h-6 w-6" />, text: "home.cert.c4" },
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
                  {/* "…to teach Arabic anywhere in the world" implied a
                      portability no register supports; the certificate is the
                      academy's own. */}
                  {certification?.description || <T>home.cert.body</T>}
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