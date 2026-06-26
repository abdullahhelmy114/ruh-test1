"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  User, Globe2, Languages, Phone, Send, Share2, FileText,
  BookOpen, MapPin, Upload, IdCard, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { AvatarCard } from "./AvatarCard";
import { Section } from "./Section";
import { Field, Input, Select, Textarea } from "./Field";
import { MultiInput } from "./MultiInput";
import { SaveButton } from "./SaveButton";
import { SocialLinks, type SocialLink } from "./SocialLinks";

interface TeacherProfileState {
  fullName: string;
  email: string;
  gender: string;
  nationality: string;
  residence: string;
  nativeLanguage: string;
  languages: string[];
  whatsapp: string;
  telegram: string;
  socials: SocialLink[];
  bio: string;
  cv: string | null;
  avatar: string | null;
}

const required: (keyof TeacherProfileState)[] = [
  "nationality", "residence", "nativeLanguage", "whatsapp", "telegram",
];

const STORAGE_KEY = "teacherProfileData";

export function TeacherProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const [s, setS] = React.useState<TeacherProfileState | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<keyof TeacherProfileState, string>>>({});
  const [save, setSave] = React.useState<"idle" | "loading" | "success">("idle");
  const cvRef = React.useRef<HTMLInputElement>(null);

  // ✅ جلب بيانات التسجيل من الخادم
  React.useEffect(() => {
    if (authLoading || !user) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user?uid=${user.uid}`);
        const data = await res.json();
        if (data.profile) {
          const p = data.profile;
          const nativeLang = p.languages?.length ? p.languages[0].code : "Arabic";
          const allLangs = p.languages?.map((l: any) => l.code) || ["Arabic", "English"];
          setS({
            fullName: `${p.first_name || ""} ${p.last_name || ""}`.trim() || user.displayName || user.email?.split("@")[0] || "",
            email: p.email || user.email || "",
            gender: p.gender || "",
            nationality: p.nationality || "",
            residence: p.country_of_residence || "",
            nativeLanguage: nativeLang,
            languages: allLangs,
            whatsapp: p.whatsapp || "",
            telegram: p.telegram || "",
            socials: p.social_links || [],
            bio: p.bio || "",
            cv: p.cv_url || null,
            avatar: user.photoURL || null,
          });
          return;
        }
      } catch {}
      // fallback إلى localStorage
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        try { setS(JSON.parse(stored)); return; } catch {}
      }
      const name = user.displayName || user.email?.split("@")[0] || "";
      setS({
        fullName: name,
        email: user.email || "",
        gender: "",
        nationality: "",
        residence: "",
        nativeLanguage: "Arabic",
        languages: ["Arabic", "English"],
        whatsapp: "",
        telegram: "",
        socials: [],
        bio: "",
        cv: null,
        avatar: user.photoURL || null,
      });
    };
    fetchProfile();
  }, [user, authLoading]);

  const set = React.useCallback(<K extends keyof TeacherProfileState>(k: K, v: TeacherProfileState[K]) => {
    setS((p) => p ? { ...p, [k]: v } : null);
  }, []);

  const completion = React.useMemo(() => {
    if (!s) return 0;
    const checks = [s.avatar, s.gender, s.nationality, s.residence, s.nativeLanguage, s.languages.length > 0, s.whatsapp, s.telegram, s.bio, s.cv];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [s]);

  const submit = React.useCallback(async () => {
    if (!s) return;
    const e: typeof errors = {};
    required.forEach((k) => { if (!String(s[k] ?? "").trim()) e[k] = "Required field"; });
    if (s.languages.length === 0) e.languages = "Add at least one language";
    setErrors(e);
    if (Object.keys(e).length > 0) { toast.error("Please complete required fields"); return; }
    setSave("loading");
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        localStorage.setItem("profileComplete", "true");
        setSave("success");
        toast.success("Profile saved successfully");
        setTimeout(() => setSave("idle"), 1600);
      } catch {
        setSave("idle");
        toast.error("فشل في حفظ البيانات");
      }
    }, 900);
  }, [s]);

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
        onAvatar={(url) => set("avatar", url)}
        stats={[
          { label: "Languages", value: String(s.languages.length) },
          { label: "Sections", value: "5" },
        ]}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Profile</p>
          <h1 className="font-serif text-4xl font-semibold text-foreground sm:text-5xl">
            Showcase your <span className="gold-text">expertise</span>
          </h1>
          <p dir="rtl" className="font-arabic text-sm text-muted-foreground">أكمل ملفك الشخصي ليطلع عليه الطلاب</p>
        </header>

        <Section step={1} title="Identity" arabic="الهوية" icon={<IdCard size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full Name" arabic="الاسم الكامل" icon={<User size={14} />}>
              <Input className="profile-fullname" value={s.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label="Email" arabic="البريد">
              <Input className="profile-email" value={s.email} disabled />
            </Field>
            <Field label="Gender" arabic="الجنس">
              <Select className="profile-gender" value={s.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Select…</option>
                <option value="male">Male / ذكر</option>
                <option value="female">Female / أنثى</option>
              </Select>
            </Field>
            <Field label="Nationality" arabic="الجنسية" required error={errors.nationality} icon={<Globe2 size={14} />}>
              <Input className="profile-nationality" value={s.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. Egyptian" />
            </Field>
            <Field label="Country of Residence" arabic="بلد الإقامة" required error={errors.residence} icon={<MapPin size={14} />}>
              <Input className="profile-residence" value={s.residence} onChange={(e) => set("residence", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section step={2} title="Languages" arabic="اللغات" icon={<Languages size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Native Language" arabic="اللغة الأم" required error={errors.nativeLanguage}>
              <Input className="profile-native-language" value={s.nativeLanguage} onChange={(e) => set("nativeLanguage", e.target.value)} placeholder="Arabic" />
            </Field>
            <Field label="Languages Spoken" arabic="اللغات التي تجيدها" required error={errors.languages}>
              <div className="profile-languages">
                <MultiInput values={s.languages} onChange={(v) => set("languages", v)} placeholder="Add a language and press Enter" />
              </div>
            </Field>
          </div>
        </Section>

        <Section step={3} title="Contact" arabic="وسائل التواصل" icon={<Phone size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="WhatsApp Number" arabic="رقم واتساب" required error={errors.whatsapp} icon={<Phone size={14} />}>
              <Input className="profile-whatsapp" dir="ltr" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+20 100 000 0000" />
            </Field>
            <Field label="Telegram Username" arabic="حساب تيليجرام" required error={errors.telegram} icon={<Send size={14} />}>
              <Input className="profile-telegram" value={s.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@username" />
            </Field>
          </div>
        </Section>

        <Section step={4} title="Social Presence" arabic="حسابات التواصل" icon={<Share2 size={20} />} defaultOpen={false}>
          <SocialLinks items={s.socials} onChange={(v) => set("socials", v)} />
        </Section>

        <Section step={5} title="About & Credentials" arabic="نبذة وسيرة ذاتية" icon={<BookOpen size={20} />} defaultOpen={false}>
          <div className="space-y-5">
            <Field label="Bio" arabic="نبذة عنه">
              <Textarea className="profile-bio" value={s.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Tell students about your teaching philosophy, qualifications, and experience..." maxLength={800} />
            </Field>
            <div className="profile-cv">
              <p className="mb-2 text-sm font-medium text-foreground">
                CV Upload <span dir="rtl" className="font-arabic text-xs text-muted-foreground">(السيرة الذاتية)</span>
              </p>
              {s.cv ? (
                <a href={s.cv} target="_blank" className="text-sm text-blue-600 underline">{s.cv}</a>
              ) : (
                <button type="button" onClick={() => cvRef.current?.click()} className="group flex w-full items-center justify-between rounded-2xl border border-dashed border-gold/40 bg-background/30 px-5 py-6 text-left transition hover:border-gold hover:bg-gold/5">
                  <div className="flex items-center gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/15 text-gold"><FileText size={20} /></span>
                    <div>
                      <p className="text-sm font-medium text-foreground">Drop your CV (PDF) or click to browse</p>
                      <p className="text-xs text-muted-foreground">PDF · max 10 MB</p>
                    </div>
                  </div>
                  <Upload size={16} className="text-muted-foreground transition group-hover:text-gold" />
                </button>
              )}
              <input ref={cvRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => set("cv", e.target.files?.[0]?.name ?? null)} />
            </div>
          </div>
        </Section>

        <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Profile completion: <span className="font-semibold text-emerald dark:text-gold">{completion}%</span>
          </p>
          <div className="profile-save-btn">
            <SaveButton onClick={submit} state={save} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}