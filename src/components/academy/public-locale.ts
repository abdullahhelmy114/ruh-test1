import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { PUBLIC_MESSAGES, type PublicMessages } from "@/lib/academy/public/messages";
import type { ProductLocale } from "@/lib/academy/domain/vocabulary";

/** The reader's locale from the existing preference cookie, with its public strings. */
export async function publicLocale(): Promise<{ locale: ProductLocale; t: PublicMessages }> {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, t: PUBLIC_MESSAGES[locale] };
}
