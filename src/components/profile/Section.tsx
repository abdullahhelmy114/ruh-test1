"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function Section({
  title, arabic, icon, defaultOpen = true, children, step,
}: {
  title: string;
  arabic?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  step?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <div className="flex items-center gap-4">
          {step !== undefined && (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald text-emerald-foreground font-serif text-sm">
              {step}
            </span>
          )}
          <span className="text-gold">{icon}</span>
          <div>
            <h3 className="font-serif text-lg font-semibold leading-tight text-foreground">{title}</h3>
            {arabic && (
              <p dir="rtl" className="font-arabic text-xs text-muted-foreground">{arabic}</p>
            )}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="border-t border-border/60 px-6 py-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}