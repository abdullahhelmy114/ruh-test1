"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function MultiInput({
  values, onChange, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="w-full py-2">
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {values.map((v) => (
            <motion.span
              key={v}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald/10 px-3 py-1 text-xs font-medium text-emerald dark:text-gold"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X size={12} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "Add..."}
          className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-gold-foreground transition hover:scale-105"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}