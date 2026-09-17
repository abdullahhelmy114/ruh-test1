"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { User, Globe2, Languages, Phone, Send, Share2, BookOpen, MapPin, IdCard, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { TEACHER_APPLICATION_HOME } from "@/lib/auth/home";
import { AvatarCard } from "./AvatarCard";
import { Section } from "./Section";
import { Field, Input, Textarea } from "./Field";
import { SaveButton } from "./SaveButton";
import { SocialLinks, type SocialLink } from "./SocialLinks";
import { languageCodes, loadOwnProfile, saveOwnProfile, storedLinks } from "./profile-api";

interface TeacherProfileState {
  fullName: string;
  email: string;
  gender: string;
  nationality: string;
  residence: string;
  languages: string[];
  whatsapp: string;
  telegram: string;
  socials: SocialLink[];
  bio: string;
  avatar: string | null;
}

const BIO_MIN = 50;
const BIO_MAX = 5000;

// The teacher's own profile, read from and saved to the server (PATCH /api/user).
// An active teacher changes the biography, contact details and profile links;
// name, nationality, gender and languages stay as approved with the
// application. A teacher account that is not active changes its details on the
// application page. The CV stays private with the application.
export function TeacherProfile() {
  const { user, isLoading: authLoading, status } = useAuth();
  const [s, setS] = React.useState<TeacherProfileState | null>(null);
  const [loadError, setLoadError] = React.useState("");
  const [bioError, setBioError] = React.useState("");
  const [save, setSave] = React.useState<"idle" | "loading" | "success">("idle");
  const active = status === "active";

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoadError("");
    const result = await loadOwnProfile();
    if (!result.ok) {
      setLoadError(result.message);
      return;
    }
    const p = result.data;
    setS({
      fullName: p.full_name || user.displayName || user.email?.split("@")[0] || "",
      email: p.email || user.email || "",
      gender: p.gender || "",
      nationality: p.nationality || "",
      residence: p.country_of_residence || "",
      languages: languageCodes(p.languages),
      whatsapp: p.whatsapp || "",
      telegram: p.telegram || "",
      socials: storedLinks(p.social_links).map((link) => ({ id: crypto.randomUUID(), label: link.platform, url: link.url })),
      bio: p.bio || "",
      avatar: user.photoURL || null,
    });
  }, [user]);

  React.useEffect(() => {
    if (authLoading || !user) return;
    void load();
  }, [user, authLoading, load]);

  const set = React.useCallback(<K extends keyof TeacherProfileState>(k: K, v: TeacherProfileState[K]) => {
    setS((p) => (p ? { ...p, [k]: v } : null));
  }, []);

  const completion = React.useMemo(() => {
    if (!s) return 0;
    const checks = [s.bio.trim().length >= BIO_MIN, s.whatsapp, s.telegram, s.socials.length > 0];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [s]);

  const submit = React.useCallback(async () => {
    if (!s || !active) return;
    const bio = s.bio.trim();
    if (bio.length < BIO_MIN || bio.length > BIO_MAX) {
      setBioError(`Between ${BIO_MIN} and ${BIO_MAX} characters`);
      toast.error("Please check your biography");
      return;
    }
    setBioError("");
    setSave("loading");
    const result = await saveOwnProfile({
      bio,
      whatsapp: s.whatsapp.trim(),
      telegram: s.telegram.trim(),
      socialLinks: s.socials.map((link) => ({ platform: link.label.trim(), url: link.url.trim() })),
    });
    if (!result.ok) {
      setSave("idle");
      toast.error(result.message);
      return;
    }
    setSave("success");
    toast.success("Profile saved successfully");
    setTimeout(() => setSave("idle"), 1600);
  }, [s, active]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <button type="button" onClick={() => void load()} className="rounded-full border px-5 py-2 text-sm">
          Try again
        </button>
      </div>
    );
  }

  if (authLoading || !s) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <AvatarCard
        name={s.fullName}
        email={s.email}
        role="Teacher"
        completion={completion}
        avatar={s.avatar}
        stats={[{ label: "Languages", value: String(s.languages.length) }]}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Profile</p>
          <h1 className="font-serif text-4xl font-semibold text-foreground sm:text-5xl">
            Showcase your <span className="gold-text">expertise</span>
          </h1>
          <p dir="rtl" className="font-arabic text-sm text-muted-foreground">أكمل ملفك الشخصي ليطلع عليه الطلاب</p>
        </header>

        {!active && (
          <div role="status" className="rounded-2xl border border-gold/40 bg-gold/5 p-4 text-sm">
            <p>Your details are part of your teacher application. You can change them on your application page when the academy asks for changes.</p>
            <Link href={TEACHER_APPLICATION_HOME} className="mt-2 inline-block font-semibold underline">
              Open your application
            </Link>
          </div>
        )}

        <Section step={1} title="Identity" arabic="الهوية" icon={<IdCard size={20} />}>
          <p className="mb-4 text-xs text-muted-foreground">These details were reviewed with your application.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full Name" arabic="الاسم الكامل" icon={<User size={14} />}>
              <Input className="profile-fullname" value={s.fullName} disabled />
            </Field>
            <Field label="Email" arabic="البريد">
              <Input className="profile-email" value={s.email} disabled />
            </Field>
            <Field label="Gender" arabic="الجنس">
              <Input className="profile-gender" value={s.gender === "male" ? "Male / ذكر" : s.gender === "female" ? "Female / أنثى" : "—"} disabled />
            </Field>
            <Field label="Nationality" arabic="الجنسية" icon={<Globe2 size={14} />}>
              <Input className="profile-nationality" value={s.nationality} disabled />
            </Field>
            <Field label="Country of Residence" arabic="بلد الإقامة" icon={<MapPin size={14} />}>
              <Input className="profile-residence" value={s.residence} disabled />
            </Field>
          </div>
        </Section>

        <Section step={2} title="Languages" arabic="اللغات" icon={<Languages size={20} />}>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {s.languages.length > 0 ? s.languages.join(", ") : "—"}
          </p>
        </Section>

        <Section step={3} title="Contact" arabic="وسائل التواصل" icon={<Phone size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="WhatsApp Number" arabic="رقم واتساب" required icon={<Phone size={14} />}>
              <Input className="profile-whatsapp" dir="ltr" value={s.whatsapp} disabled={!active} maxLength={32} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+20 100 000 0000" />
            </Field>
            <Field label="Telegram Username" arabic="حساب تيليجرام" required icon={<Send size={14} />}>
              <Input className="profile-telegram" dir="ltr" value={s.telegram} disabled={!active} maxLength={33} onChange={(e) => set("telegram", e.target.value)} placeholder="@username" />
            </Field>
          </div>
        </Section>

        {active && (
          <Section step={4} title="Social Presence" arabic="حسابات التواصل" icon={<Share2 size={20} />} defaultOpen={false}>
            <SocialLinks items={s.socials} onChange={(v) => set("socials", v)} />
          </Section>
        )}

        <Section step={5} title="About" arabic="نبذة" icon={<BookOpen size={20} />}>
          <Field label="Bio" arabic="نبذة عنك" required error={bioError}>
            <Textarea
              className="profile-bio"
              value={s.bio}
              disabled={!active}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="Tell students about your teaching philosophy, qualifications, and experience..."
              maxLength={BIO_MAX}
            />
          </Field>
          <p className="mt-3 text-xs text-muted-foreground">Your CV stays private with your application.</p>
        </Section>

        <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Profile completion: <span className="font-semibold text-primary dark:text-gold">{completion}%</span>
          </p>
          {active && (
            <div className="profile-save-btn">
              <SaveButton onClick={submit} state={save} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
