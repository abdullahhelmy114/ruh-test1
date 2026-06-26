"use client";

import * as React from "react";
import { Plus, Trash2, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type SocialLink = { id: string; label: string; url: string };

export function SocialLinks({ items, onChange }: {
  items: SocialLink[]; onChange: (v: SocialLink[]) => void;
}) {
  const add = () => onChange([...items, { id: crypto.randomUUID(), label: "", url: "" }]);
  const update = (id: string, patch: Partial<SocialLink>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="grid grid-cols-12 gap-2"
          >
            <div className="field-glow col-span-4 flex items-center rounded-xl border border-border bg-background/40 px-3">
              <input
                value={it.label}
                onChange={(e) => update(it.id, { label: e.target.value })}
                placeholder="Platform (Instagram)"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="field-glow col-span-7 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3">
              <Link2 size={14} className="text-gold" />
              <input
                value={it.url}
                onChange={(e) => update(it.id, { url: e.target.value })}
                placeholder="https://..."
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="col-span-1 grid place-items-center rounded-xl border border-border text-destructive transition hover:bg-destructive/10"
              aria-label="Remove"
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-gold/50 px-4 py-2 text-xs font-medium text-emerald transition hover:bg-gold/10 dark:text-gold"
      >
        <Plus size={14} /> Add social account
      </button>
    </div>
  );
}