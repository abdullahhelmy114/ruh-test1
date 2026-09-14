import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  inter,
  playfair,
  amiri,
  dancing_script,
  pinyon_script,
  quattrocento,
  scheherazade_new,
} from "@/lib/fonts";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import AIChatBubbleLazy from "@/components/shared/AIChatBubbleLazy";
import { Footer } from "@/components/shared/Footer";
import AuthProviderLazy from "@/lib/firebase/AuthProviderLazy";
import { LOCALE_COOKIE, localeDirection, resolveLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Ruh-Ul-Qudus Academy | Learn Arabic & Quran Online",
  description:
    "Master Arabic and Quran with interactive lessons, AI-powered practice, quizzes, and certified courses for non-native speakers. Start your journey today.",
  keywords: [
    "Learn Arabic online",
    "Quran for non-native speakers",
    "Arabic language course",
    "Quran tajweed",
    "Online Islamic academy",
    "Arabic for beginners",
    "Ruh-Ul-Qudus Academy",
  ],
  alternates: {
    canonical: "https://ruhulqudus.com",
    languages: {
      en: "https://ruhulqudus.com/en",
      ar: "https://ruhulqudus.com/ar",
      tr: "https://ruhulqudus.com/tr",
    },
  },
  openGraph: {
    title: "Ruh-Ul-Qudus Academy | Learn Arabic & Quran",
    description:
      "An elite digital institution for Arabic and Quran, blending classical pedagogy with modern technology.",
    url: "https://ruhulqudus.com",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [
      {
        url: "https://ruhulqudus.com/light.png",
        width: 1200,
        height: 630,
        alt: "Ruh-Ul-Qudus Academy – Learn Arabic and Quran",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ruh-Ul-Qudus Academy | Learn Arabic & Quran",
    description:
      "Master Arabic and Quran with interactive lessons, AI-powered practice, and certified courses.",
    images: ["https://ruhulqudus.com/light.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // ضبط اتجاه الصفحة ولغتها على الخادم من ملف تعريف الارتباط (بدون سكربت تمهيدي).
  // The locale preference cookie is validated against the project's locale
  // list; unknown values fall back to the default. This replaces the former
  // next/script beforeInteractive bootstrap, which React 19 flagged as
  // "Encountered a script tag while rendering React component".
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://ruhulqudus-48d29.firebaseapp.com" />
        <link rel="preconnect" href="https://www.gstatic.com" />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} ${amiri.variable} ${dancing_script.variable} ${pinyon_script.variable} ${quattrocento.variable} ${scheherazade_new.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <AuthProviderLazy>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <AIChatBubbleLazy />
            <Toaster />
          </ThemeProvider>
        </AuthProviderLazy>
      </body>
    </html>
  );
}