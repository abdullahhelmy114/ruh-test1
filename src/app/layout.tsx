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
  title: "Ruh-Ul-Qudus Academy | أرقى منصة لتعلم العربية",
  description: "Traditional wisdom meets modern learning technology.",
  icons: {
    icon: [
      { url: '/light1.png', media: '(prefers-color-scheme: light)' },
      { url: '/dark.png', media: '(prefers-color-scheme: dark)' },
    ],
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