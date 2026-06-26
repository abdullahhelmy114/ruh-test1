"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function SaveButton({
  onClick, state, label = "Save Changes",
}: {
  onClick: () => void;
  state: "idle" | "loading" | "success";
  label?: string;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [t, setT] = React.useState({ x: 0, y: 0 });

  return (
    <motion.button
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        setT({ x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.18 });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      animate={{ x: t.x, y: t.y }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      onClick={onClick}
      disabled={state !== "idle"}
      className={cn(
        "group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-8 font-medium transition",
        "bg-emerald text-emerald-foreground shadow-[0_10px_30px_-10px] shadow-emerald/60 hover:shadow-gold/50",
        "disabled:opacity-90",
      )}
    >
      <span className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-gold/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {state === "loading" ? <Loader2 size={16} className="animate-spin" /> :
        state === "success" ? <Check size={16} /> : <Save size={16} />}
      <span className="relative">
        {state === "loading" ? "Saving..." : state === "success" ? "Saved" : label}
      </span>
    </motion.button>
  );
}