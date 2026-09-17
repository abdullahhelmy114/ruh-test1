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
  /** The academy's time zone, or null when the academy has not configured `institution.timezone`. */
  readonly timeZone: string | null;
  readonly fmt: typeof fmt;
  readonly date: (value: string | null | undefined) => string;
  readonly dateTime: (value: string | null | undefined) => string;
  readonly sessionTime: (value: string | null | undefined) => string;
  readonly percent: (ratio: number | null | undefined) => string;
  readonly number: (value: number | null | undefined) => string;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/**
 * Locale, interface text and the academy's time zone for the workspace.
 *
 * The server layout resolves all three and passes them down: the locale from
 * the preference cookie, and the zone from the `institution.timezone` policy,
 * the same source the Lesson Sheet release rule uses. Resolving the zone on
 * the server is what makes a session time render identically here and in the
 * HTML, whatever zone the viewer's machine is in. `timeZone` is null only when
 * the academy has not configured that policy; times are then left blank rather
 * than shown against some other clock.
 */
export function WorkspaceProvider({
  locale,
  messages,
  timeZone,
  children,
}: {
  readonly locale: ProductLocale;
  readonly messages: WorkspaceText;
  readonly timeZone: string | null;
  readonly children: ReactNode;
}) {
  const value = useMemo<WorkspaceValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      t: messages,
      timeZone,
      fmt,
      date: (v) => formatDate(v, locale, timeZone),
      dateTime: (v) => formatDateTime(v, locale, timeZone),
      sessionTime: (v) => formatSessionTime(v, locale, timeZone),
      percent: (v) => formatPercent(v, locale),
      number: (v) => formatNumber(v, locale),
    }),
    [locale, messages, timeZone],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
