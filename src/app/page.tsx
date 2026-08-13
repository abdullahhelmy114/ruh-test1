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
  Star,
  Shield,
  Globe,
  GraduationCap,
  Heart,
  MessageCircle,
  Calendar,
  ChevronRight,
  PackageOpen,
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

// Static Testimonials
const testimonials = [
  {
    name: "Ahmed Al-Khalidi",
    role: "Student",
    text: "The best decision I ever made. Dr. Jehan's method transformed my Arabic in 3 months.",
    avatar: "A",
  },
  {
    name: "Fatima Noor",
    role: "Student",
    text: "The live cohorts are incredible. You feel like you're in a real classroom with friends.",
    avatar: "F",
  },
  {
    name: "Ustadh Bilal",
    role: "Teacher",
    text: "Teaching here gave me the tools to reach students worldwide with a professional curriculum.",
    avatar: "B",
  },
];

export default function HomePage() {
  const [featuredcourse, setFeaturedcourse] = useState<any[]>([]);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [certification, setCertification] = useState<any>(null);
  const [stats, setStats] = useState({
    students: "12K+",
    completion: "98%",
    experience: "30+",
  });

  useEffect(() => {
    // Fetch real stats (example: from an API or static)
    // يمكن استبدالها بقيم حقيقية من /api/stats إذا وُجدت
    // تركناها ثابتة كمثال

    // Featured course
    fetch("/api/courses?limit=3")
      .then((r) => r.json())
      .then((d) => setFeaturedcourse((d.course || []).slice(0, 3)))
      .catch(() => {});

    // Blog Posts
    fetch("/api/blog/posts?limit=3")
      .then((r) => r.json())
      .then((d) => setBlogPosts((d.posts || []).slice(0, 3)))
      .catch(() => {});

    // Bundles
    fetch("/api/bundles")
      .then((r) => r.json())
      .then((d) => setBundles(d.bundles || []))
      .catch(() => {});

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
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
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

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02]"
              >
                <T>Begin Your Journey</T> <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-full border bg-card px-6 py-3 text-sm font-semibold transition hover:bg-accent"
              >
                <T>Browse course</T>
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t pt-6">
              {[
                { v: stats.students, l: "Students" },
                { v: stats.completion, l: "Completion" },
                { v: stats.experience, l: "Years Teaching" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-serif text-2xl text-gold">{s.v}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    <T>{s.l}</T>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gold/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] gradient-hero p-10 text-primary-foreground shadow-elegant">
              <div
                className="font-arabic text-right text-7xl leading-tight"
                style={{ fontFamily: "Amiri, serif" }}
              >
                ٱقْرَأْ
              </div>
              <div className="mt-2 text-right text-sm text-gold">
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
                    className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 backdrop-blur"
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

      {/* ─── Featured course (بيانات حقيقية) ──────────────── */}
      {featuredcourse.length > 0 && (
        <section className="bg-muted/30 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <motion.div {...fadeInUp} className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
                <T>Featured course</T>
              </div>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl">
                <T>Start your Arabic journey</T>
              </h2>
            </motion.div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {featuredcourse.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group overflow-hidden rounded-3xl border bg-card shadow-elegant transition-all hover:-translate-y-1 hover:shadow-elegant"
                >
                  <Link href={`/course/${course.id}`}>
                    <div className="h-40 bg-linear-to-br from-primary to-primary/80 flex items-center justify-center relative overflow-hidden">
                      {course.image_url ? (
                        <Image
                          src={course.image_url}
                          alt={course.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <BookOpen className="h-12 w-12 text-primary-foreground/30" />
                      )}
                      <span className="absolute top-3 right-3 rounded-full bg-foreground/30 px-3 py-1 text-xs font-bold text-primary-foreground backdrop-blur-sm">
                        {course.level}
                      </span>
                    </div>
                  </Link>
                  <div className="p-5">
                    <Link href={`/course/${course.id}`}>
                      <h3 className="font-serif text-lg font-semibold hover:text-accent-foreground transition-colors line-clamp-1">
                        {course.title}
                      </h3>
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <T>by</T> {course.teacher_name}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-serif text-2xl font-bold text-accent-foreground">
                        {course.price === 0 ? <T>Free</T> : `$${course.price}`}
                      </span>
                      <Link
                        href={`/course/${course.id}`}
                        className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition"
                      >
                        <T>Learn More</T>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-full border-2 border-primary/50 px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-primary/10 transition"
              >
                <T>View All course</T> <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── Bundles Section ──────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <motion.div {...fadeInUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
              <T>Bundles</T>
            </div>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              <T>Curated learning paths</T>
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {bundles.length > 0 ? (
              bundles.map((bundle, i) => (
                <motion.div
                  key={bundle.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group overflow-hidden rounded-3xl border bg-card shadow-elegant transition-all hover:-translate-y-1 hover:shadow-elegant"
                >
                  <div className="h-40 bg-linear-to-br from-accent to-accent/80 flex items-center justify-center">
                    <PackageOpen className="h-16 w-16 text-primary-foreground/40" />
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-lg font-semibold">{bundle.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {bundle.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-serif text-2xl font-bold text-accent-foreground">
                        ${bundle.price}
                      </span>
                      <Link
                        href="/bundles"
                        className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition"
                      >
                        <T>View</T>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="md:col-span-3 flex flex-col items-center justify-center py-12 text-center">
                <PackageOpen className="h-16 w-16 text-accent-foreground/50 mb-4" />
                <p className="text-muted-foreground text-lg">
                  <T>No bundles available yet.</T>
                </p>
                <Link
                  href="/bundles"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition"
                >
                  <T>Explore Bundles</T> <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

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
                  <T>Learn More</T> <ArrowRight className="h-4 w-4" />
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

      {/* ─── Testimonials ────────────────────────────────── */}
      <section className="bg-linear-to-br from-accent/5 to-primary/5 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <motion.div {...fadeInUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
              <T>Testimonials</T>
            </div>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              <T>What our students say</T>
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-3xl border bg-card p-6 shadow-elegant"
              >
                <div className="flex gap-1 text-secondary-foreground">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-sm italic leading-relaxed text-muted-foreground">
                  &quot;<T>{t.text}</T>&quot;
                </p>
                <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-4">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-linear-to-br from-primary to-primary/80 text-primary-foreground font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <T>{t.role}</T>
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl gradient-hero p-10 text-primary-foreground shadow-elegant md:p-16"
        >
          <Sparkles className="absolute right-10 top-10 h-8 w-8 text-gold" />
          <div className="relative max-w-2xl">
            <h2 className="font-serif text-4xl md:text-5xl">
              <T>A tradition of excellence, now at your fingertips.</T>
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              <T>
                Whether you&apos;re beginning your first letter or refining your
                scholarly voice, the Academy welcomes you.
              </T>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full gradient-gold px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold"
              >
                <T>Enroll Today</T> <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-white/10"
              >
                <T>Explore course</T>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}