"use client";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";

export function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="min-h-screen">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">{children}</main>
        <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
          <p className="font-serif">Ruhulqudus Academy · Elite Arabic Language Studies</p>
        </footer>
        <Toaster position="top-center" richColors />
      </div>
    </ThemeProvider>
  );
}