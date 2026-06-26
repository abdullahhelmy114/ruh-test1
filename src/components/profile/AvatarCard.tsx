"use client";

import * as React from "react";
import { Camera, Mail, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { ProgressRing } from "./ProgressRing";

export function AvatarCard({
  name, email, role, completion, avatar, onAvatar, stats,
}: {
  name: string; email: string; role: string; completion: number;
  avatar: string | null;
  onAvatar: (url: string) => void;
  stats?: { label: string; value: string }[];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handle = (f?: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onAvatar(reader.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-strong arabesque sticky top-24 flex flex-col items-center gap-6 rounded-3xl p-8 text-center"
    >
      <div className="relative">
        <div className="absolute -inset-2 rounded-full bg-linear-to-tr from-gold via-emerald to-gold opacity-70 blur-md" />
        <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-gold/40 bg-muted">
          {avatar ? (
            <img src={avatar} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center font-serif text-4xl text-emerald dark:text-gold">
              {name.charAt(0) || "؟"}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-gold text-gold-foreground shadow-lg transition hover:scale-110"
          aria-label="Upload avatar"
        >
          <Camera size={15} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>

      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">{name}</h2>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs">
          <Shield size={12} className="text-gold" />
          <span className="font-medium text-emerald dark:text-gold">{role}</span>
        </div>
        <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Mail size={12} /> {email}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProgressRing value={completion} />
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles size={12} className="text-gold" /> Profile completion
        </p>
      </div>

      {stats && stats.length > 0 && (
        <div className="grid w-full grid-cols-2 gap-3 border-t border-border/60 pt-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-serif text-xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </motion.aside>
  );
}