"use client";
import { T } from "@/components/TranslatedText";
import { cn } from "@/lib/utils";
import { ListFilter, ChevronDown } from "lucide-react";
import { useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

export function CategoryTabs({
  categories,
  activeSlug,
  onSelect,
}: {
  categories: Category[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCat = categories.find((c) => c.slug === activeSlug) || { name: "All" };

  return (
    <>
      {/* Mobile Dropdown */}
      <div className="mb-6 lg:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-full border border-primary/25 bg-card/60 px-5 py-3 text-sm text-foreground backdrop-blur-md"
        >
          <span className="inline-flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-accent" />
            <T>{activeCat.name === "All" ? "All Categories" : activeCat.name}</T>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-accent transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/60 p-3 backdrop-blur-md">
            <button
              onClick={() => { onSelect(""); setOpen(false); }}
              className={cn("rounded-full px-5 py-2.5 text-sm text-right transition-all duration-300", activeSlug === "" ? "bg-primary text-primary-foreground shadow-md" : "border border-primary/20 bg-card/50 text-foreground backdrop-blur-md hover:border-accent/50")}
            >
              <T>All</T>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat.slug); setOpen(false); }}
                className={cn("rounded-full px-5 py-2.5 text-sm text-right transition-all duration-300", activeSlug === cat.slug ? "bg-primary text-primary-foreground shadow-md" : "border border-primary/20 bg-card/50 text-foreground backdrop-blur-md hover:border-accent/50")}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-8 rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-md">
          <p className="mb-4 text-xs uppercase tracking-widest text-accent font-semibold"><T>Categories</T></p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onSelect("")}
              className={cn("rounded-full px-5 py-2.5 text-sm text-left transition-all duration-300", activeSlug === "" ? "bg-primary text-primary-foreground shadow-md" : "border border-primary/20 bg-card/50 text-foreground backdrop-blur-md hover:border-accent/50")}
            >
              <T>All</T>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.slug)}
                className={cn("rounded-full px-5 py-2.5 text-sm text-left transition-all duration-300", activeSlug === cat.slug ? "bg-primary text-primary-foreground shadow-md" : "border border-primary/20 bg-card/50 text-foreground backdrop-blur-md hover:border-accent/50")}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}