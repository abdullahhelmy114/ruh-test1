import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { WorkspaceProvider } from "@/components/academy/workspace/context";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { WORKSPACE_MESSAGES } from "@/lib/academy/workspace/messages";

// Teacher signup uses the academy's interface text (English, Arabic, Turkish),
// resolved on the server from the reader's preference cookie.
export const metadata: Metadata = {
  title: "Apply to teach | Ruh-Ul-Qudus Academy",
  description: "Create an account and apply to teach at Ruh-Ul-Qudus Academy.",
};

export default async function TeacherSignupLayout({ children }: { readonly children: ReactNode }) {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <WorkspaceProvider locale={locale} messages={WORKSPACE_MESSAGES[locale]}>
      {children}
    </WorkspaceProvider>
  );
}
