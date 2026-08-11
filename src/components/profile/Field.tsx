"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

type Common = {
  label: string;
  arabic?: string;
  required?: boolean;
  error?: string;
  dir?: "ltr" | "rtl";
  icon?: React.ReactNode;
};

export function Field({
  label, arabic, required, error, dir, icon, children,
}: Common & { children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline justify-between gap-2 text-sm font-medium text-foreground">
        <span className="inline-flex items-center gap-2">
          {icon ? <span className="text-gold">{icon}</span> : null}
          {label}
          {required && <span className="text-gold">*</span>}
        </span>
        {arabic && (
          <span dir="rtl" className="font-arabic text-xs text-muted-foreground">{arabic}</span>
        )}
      </label>
      <div
        dir={dir}
        className={cn(
          "field-glow group flex items-center rounded-xl border bg-background/40 px-3.5 transition",
          "border-border focus-within:border-gold",
          error && "border-destructive",
        )}
      >
        {children}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60",
        className,
      )}
      {...p}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-none bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/60",
        className,
      )}
      {...p}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full bg-transparent text-sm outline-none",
        className,
      )}
      {...p}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";