"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { User, Globe2, Languages, Phone, MessageCircle, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { AvatarCard } from "./AvatarCard";
import { Section } from "./Section";
import { Field, Input, Select } from "./Field";
import { SaveButton } from "./SaveButton";
import { languageCodes, loadOwnProfile, saveOwnProfile } from "./profile-api";

interface ProfileState {
  fullName: string;
  email: string;
  avatar: string | null;
  gender: string;
  nationality: string;
  languages: string[];
  residence: string;
  whatsapp: string;
  telegram: string;
}

// The student's own profile, read from and saved to the server (PATCH /api/user).
// Success is shown only after the server stored the change; nothing is kept in
// browser storage. The picture comes from the sign-in account and is not
// uploaded here.
export function StudentProfile({ readOnly = false }: { readOnly?: boolean }) {
  const { user, isLoading: authLoading } = useAuth();
  const [s, setS] = React.useState<ProfileState | null>(null);
  const [loadError, setLoadError] = React.useState("");
  const [save, setSave] = React.useState<"idle" | "loading" | "success">("idle");

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
      avatar: user.photoURL || null,
      gender: p.gender || "",
      nationality: p.nationality || "",
      languages: languageCodes(p.languages),
      residence: p.country_of_residence || "",
      whatsapp: p.whatsapp || "",
      telegram: p.telegram || "",
    });
  }, [user]);

  React.useEffect(() => {
    if (authLoading || !user) return;
    void load();
  }, [user, authLoading, load]);

  const set = React.useCallback(<K extends keyof ProfileState>(k: K, v: ProfileState[K]) => {
    setS((p) => (p ? { ...p, [k]: v } : null));
  }, []);

  const completion = React.useMemo(() => {
    if (!s) return 0;
    const checks = [s.gender, s.nationality, s.residence, s.whatsapp || s.telegram];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [s]);

  const submit = React.useCallback(async () => {
    if (!s) return;
    setSave("loading");
    const result = await saveOwnProfile({
      gender: s.gender,
      nationality: s.nationality.trim(),
      countryOfResidence: s.residence.trim(),
      whatsapp: s.whatsapp.trim(),
      telegram: s.telegram.trim(),
    });
    if (!result.ok) {
      setSave("idle");
      toast.error(result.message);
      return;
    }
    setSave("success");
    toast.success("Profile saved");
    setTimeout(() => setSave("idle"), 1500);
  }, [s]);

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
        role="Student"
        completion={completion}
        avatar={s.avatar}
        stats={[{ label: "Languages", value: String(s.languages.length) }]}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-6"
      >
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Profile</p>
          <h1 className="font-serif text-4xl font-semibold text-foreground sm:text-5xl">
            Begin your <span className="gold-text">journey</span>
          </h1>
          <p dir="rtl" className="font-arabic text-sm text-muted-foreground">أهلاً بك في أَكَادِيمِيَّةُ رُوحُ الْقُدُسِ</p>
        </header>

        <Section step={1} title="Personal" arabic="المعلومات الشخصية" icon={<User size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Gender" arabic="الجنس">
              <Select className="profile-gender" value={s.gender} disabled={readOnly} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Select…</option>
                <option value="male">Male / ذكر</option>
                <option value="female">Female / أنثى</option>
              </Select>
            </Field>
            <Field label="Nationality" arabic="الجنسية" icon={<Globe2 size={14} />}>
              <Input className="profile-nationality" value={s.nationality} disabled={readOnly} maxLength={80} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
            <Field label="Country of Residence" arabic="بلد الإقامة">
              <Input className="profile-residence" value={s.residence} disabled={readOnly} maxLength={80} onChange={(e) => set("residence", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section step={2} title="Languages" arabic="اللغات" icon={<Languages size={20} />}>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {s.languages.length > 0 ? s.languages.join(", ") : "—"}
          </p>
        </Section>

        <Section step={3} title="Contact" arabic="وسائل التواصل" icon={<Phone size={20} />} defaultOpen={false}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Email" arabic="البريد" icon={<Mail size={14} />}>
              <Input className="profile-email" value={s.email} disabled />
            </Field>
            <Field label="WhatsApp" arabic="واتساب" icon={<Phone size={14} />}>
              <Input className="profile-whatsapp" dir="ltr" value={s.whatsapp} disabled={readOnly} maxLength={32} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="Telegram" arabic="تيليجرام" icon={<MessageCircle size={14} />}>
              <Input className="profile-telegram" dir="ltr" value={s.telegram} disabled={readOnly} maxLength={33} onChange={(e) => set("telegram", e.target.value)} placeholder="@username" />
            </Field>
          </div>
        </Section>

        <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Profile completion: <span className="font-semibold text-primary dark:text-gold">{completion}%</span>
          </p>
          <div className="profile-save-btn">{!readOnly && <SaveButton onClick={submit} state={save} />}</div>
        </div>
      </motion.div>
    </div>
  );
}
