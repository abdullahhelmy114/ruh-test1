"use client";
import { T } from "@/components/TranslatedText";

interface Category {
  id: string;
  name: string;
  slug: string;
}

export function CategoryTabs({ categories, activeSlug, onSelect }: {
  categories: Category[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      <button onClick={() => onSelect("")} className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeSlug === "" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>
        <T>الكل</T>
      </button>
      {categories.map(cat => (
        <button key={cat.id} onClick={() => onSelect(cat.slug)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeSlug === cat.slug ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>
          {cat.name}
        </button>
      ))}
    </div>
  );
}