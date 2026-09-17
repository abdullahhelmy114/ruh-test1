import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { WorkspaceProvider } from "@/components/academy/workspace/context";
import { WorkspaceShell } from "@/components/academy/workspace/shell";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { WORKSPACE_MESSAGES } from "@/lib/academy/workspace/messages";

// Signed-in academy workspace for learners, teachers and administrators.
// Functional baseline only; visual design comes later. Every screen reads
// through the academy API, which enforces access on the server.
export const metadata: Metadata = {
  title: "Academy workspace | Ruh-Ul-Qudus Academy",
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { readonly children: ReactNode }) {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <WorkspaceProvider locale={locale} messages={WORKSPACE_MESSAGES[locale]}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
