import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AdminTextProvider, ManageNav } from "@/components/academy/workspace/admin/kit";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { ADMIN_MESSAGES } from "@/lib/academy/workspace/admin-messages";

// Academy administration. The administrator role is enforced by every
// /api/admin/academy endpoint on the server; these screens hold no authority.
export default async function ManageLayout({ children }: { readonly children: ReactNode }) {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <AdminTextProvider text={ADMIN_MESSAGES[locale]}>
      <ManageNav />
      {children}
    </AdminTextProvider>
  );
}
