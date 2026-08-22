import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "About Us | Ruh-Ul-Qudus Academy",
  description: "Learn about Ruh-Ul-Qudus Academy, our mission to teach Arabic and Quran to non-native speakers with modern technology.",
  alternates: { canonical: "https://ruhulqudus.com/about" },
  openGraph: {
    title: "About Ruh-Ul-Qudus Academy",
    description: "An elite institution for Arabic and Quran, founded by Dr. Jehan Ali Ziad, blending classical education with modern learning.",
    url: "https://ruhulqudus.com/about",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "About Ruh-Ul-Qudus Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Ruh-Ul-Qudus Academy",
    description: "Learn about our mission to teach Arabic and Quran with excellence.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ضبط اتجاه الصفحة قبل أي عرض */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var locale = localStorage.getItem('preferred-locale') || 'en';
                  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
                  document.documentElement.lang = locale;
                } catch (e) {}
              })();
            `,
          }}
        />
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