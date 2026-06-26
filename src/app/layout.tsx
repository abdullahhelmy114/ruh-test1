// app/layout.tsx
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { AIChatBubble } from "@/components/shared/AIChatBubble";
import { Footer } from "@/components/shared/Footer";
import { AuthProvider } from "@/lib/firebase/AuthProvider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });


export const metadata: Metadata = {
  title: "Ruhulqudus Academy | أرقى منصة لتعلم العربية",
  description: "Traditional wisdom meets modern learning technology.",
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
        {/* روابط الخطوط المطلوبة للشهادة */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Dancing+Script:wght@400;700&family=Inter:wght@400;500&family=Pinyon+Script&family=Quattrocento:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <div className="relative flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <AIChatBubble />
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}