"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ProductLocale } from "@/lib/academy/domain/vocabulary";
import type { WorkspaceText } from "@/lib/academy/workspace/messages";
import {
  fmt,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatSessionTime,
} from "@/lib/academy/workspace/format";

interface WorkspaceValue {
  readonly locale: ProductLocale;
  readonly dir: "rtl" | "ltr";
  readonly t: WorkspaceText;
  readonly fmt: typeof fmt;
  readonly date: (value: string | null | undefined) => string;
  readonly dateTime: (value: string | null | undefined) => string;
  readonly sessionTime: (value: string | null | undefined) => string;
  readonly percent: (ratio: number | null | undefined) => string;
  readonly number: (value: number | null | undefined) => string;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/**
 * Locale and interface text for the workspace. The server layout resolves the
 * locale from the preference cookie and passes only that locale's text.
 */
export function WorkspaceProvider({
  locale,
  messages,
  children,
}: {
  readonly locale: ProductLocale;
  readonly messages: WorkspaceText;
  readonly children: ReactNode;
}) {
  const value = useMemo<WorkspaceValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t: messages,
      fmt,
      date: (v) => formatDate(v, locale),
      dateTime: (v) => formatDateTime(v, locale),
      sessionTime: (v) => formatSessionTime(v, locale),
      percent: (v) => formatPercent(v, locale),
      number: (v) => formatNumber(v, locale),
    }),
    [locale, messages],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
