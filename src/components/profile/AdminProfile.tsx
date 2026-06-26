"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { User, Phone, Send, Shield, Globe2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { AvatarCard } from "./AvatarCard";
import { Section } from "./Section";
import { Field, Input } from "./Field";
import { SaveButton } from "./SaveButton";

interface AdminProfileState {
  fullName: string;
  email: string;
  avatar: string | null;
  nationality: string;
  residence: string;
  whatsapp: string;
  telegram: string;
}

const STORAGE_KEY = "adminProfileData";

export function AdminProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const [s, setS] = React.useState<AdminProfileState | null>(null);
  const [save, setSave] = React.useState<"idle" | "loading" | "success">("idle");

  React.useEffect(() => {
    if (authLoading) return;
    if (user) {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setS(parsed);
          return;
        } catch {}
      }
      const name = user.displayName || user.email?.split("@")[0] || "";
      setS({
        fullName: name,
        email: user.email || "",
        avatar: user.photoURL || null,
        nationality: "",
        residence: "",
        whatsapp: "",
        telegram: "",
      });
    }
  }, [user, authLoading]);

  const set = React.useCallback(<K extends keyof AdminProfileState>(k: K, v: AdminProfileState[K]) => {
    setS((p) => p ? { ...p, [k]: v } : null);
  }, []);

  const completion = React.useMemo(() => {
    if (!s) return 0;
    const checks = [s.avatar, s.nationality, s.residence, s.whatsapp, s.telegram];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [s]);

  const submit = React.useCallback(async () => {
    if (!s) return;
    setSave("loading");
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        localStorage.setItem("profileComplete", "true");
        setSave("success");
        toast.success("تم تحديث بروفايل المشرف");
        setTimeout(() => setSave("idle"), 1500);
      } catch {
        setSave("idle");
        toast.error("فشل في حفظ البيانات");
      }
    }, 800);
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
        role="Administrator"
        completion={completion}
        avatar={s.avatar}
        onAvatar={(u) => set("avatar", u)}
        stats={[{ label: "Permissions", value: "All" }, { label: "Members", value: "248" }]}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Profile</p>
          <h1 className="font-serif text-4xl font-semibold text-foreground sm:text-5xl">
            Administrator <span className="gold-text">control</span>
          </h1>
          <p dir="rtl" className="font-arabic text-sm text-muted-foreground">إدارة أكاديمية روح القدس</p>
        </header>

        <Section step={1} title="Identity" arabic="الهوية" icon={<Shield size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full Name" arabic="الاسم" icon={<User size={14} />}>
              <Input value={s.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label="Email" arabic="البريد">
              <Input value={s.email} disabled />
            </Field>
            <Field label="Nationality" arabic="الجنسية" icon={<Globe2 size={14} />}>
              <Input value={s.nationality} onChange={(e) => set("nationality", e.target.value)} />
            </Field>
            <Field label="Residence" arabic="الإقامة">
              <Input value={s.residence} onChange={(e) => set("residence", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section step={2} title="Contact" arabic="التواصل" icon={<Phone size={20} />}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="WhatsApp" arabic="واتساب" icon={<Phone size={14} />}>
              <Input dir="ltr" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="Telegram" arabic="تيليجرام" icon={<Send size={14} />}>
              <Input value={s.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@username" />
            </Field>
          </div>
        </Section>

        <div className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Profile completion: <span className="font-semibold text-emerald dark:text-gold">{completion}%</span>
          </p>
          <SaveButton onClick={submit} state={save} />
        </div>
      </motion.div>
    </div>
  );
}