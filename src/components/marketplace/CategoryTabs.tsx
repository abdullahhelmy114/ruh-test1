"use client";
import { T } from "@/components/TranslatedText";
import { cn } from "@/lib/utils";
import { ListFilter, ChevronDown, LayoutGrid, Check } from "lucide-react";
import { useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

/* عنصر زر واحد داخل القائمة */
function CatButton({
  active,
  onClick,
  children,
  align = "start",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm transition-all duration-300",
        align === "end" ? "justify-end text-right" : "justify-start text-left",
        active
          ? "bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_rgba(0,0,0,.55)]"
          : "border border-border/60 bg-card/50 text-foreground backdrop-blur-md hover:border-gold/50 hover:bg-gold/10",
      )}
    >
      {/* لمعة ذهبية عند المرور */}
      <span
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300",
          !active && "group-hover:opacity-100",
        )}
        style={{
          backgroundImage:
            "linear-gradient(100deg, transparent 20%, rgba(196,154,60,.18) 50%, transparent 80%)",
        }}
      />
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300",
          active ? "bg-gold" : "bg-gold/30 group-hover:bg-gold/70",
        )}
      />
      <span className="relative truncate">{children}</span>
      {active && <Check className="relative ms-auto h-3.5 w-3.5 opacity-80" />}
    </button>
  );
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
      {/* ───── Mobile Dropdown ───── */}
      <div className="mb-6 lg:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-full border border-gold/30 bg-card/70 px-5 py-3 text-sm text-foreground shadow-[0_12px_30px_-18px_rgba(0,0,0,.5)] backdrop-blur-md transition-colors hover:border-gold/60"
        >
          <span className="inline-flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-gold" />
            <T>{activeCat.name === "All" ? "All Categories" : activeCat.name}</T>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-gold transition-transform duration-300", open && "rotate-180")}
          />
        </button>

        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-[0_20px_45px_-24px_rgba(0,0,0,.5)] backdrop-blur-md">
              <CatButton
                align="end"
                active={activeSlug === ""}
                onClick={() => {
                  onSelect("");
                  setOpen(false);
                }}
              >
                <T>All</T>
              </CatButton>
              {categories.map((cat) => (
                <CatButton
                  key={cat.id}
                  align="end"
                  active={activeSlug === cat.slug}
                  onClick={() => {
                    onSelect(cat.slug);
                    setOpen(false);
                  }}
                >
                  {cat.name}
                </CatButton>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ───── Desktop Sidebar ───── */}
      <aside className="hidden w-60 shrink-0 lg:mt-[3.00rem] lg:block">
        <div
          className="sticky top-8 rounded-2xl p-[1.5px] shadow-[0_24px_60px_-30px_rgba(0,0,0,.55)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(34,197,94,.55), rgba(251,146,60,.45), rgba(34,197,94,.55))",
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl">
            <div className="p-5">
              <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                <LayoutGrid className="h-3.5 w-3.5" />
                <T>Categories</T>
              </p>

              <div className="flex flex-col gap-2">
                <CatButton active={activeSlug === ""} onClick={() => onSelect("")}>
                  <T>All</T>
                </CatButton>
                {categories.map((cat) => (
                  <CatButton
                    key={cat.id}
                    active={activeSlug === cat.slug}
                    onClick={() => onSelect(cat.slug)}
                  >
                    {cat.name}
                  </CatButton>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
