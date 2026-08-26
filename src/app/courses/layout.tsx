import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Courses | Ruh-Ul-Qudus Academy",
  description: "Explore structured Arabic language and Quran courses designed for beginners to advanced learners. Start learning today.",
  alternates: { canonical: "https://ruhulqudus.com/courses" },
  openGraph: {
    title: "Courses | Ruh-Ul-Qudus Academy",
    description: "Browse our comprehensive courses for Arabic and Quran, tailored for all levels.",
    url: "https://ruhulqudus.com/courses",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Arabic & Quran Courses" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Courses | Ruh-Ul-Qudus Academy",
    description: "Find the perfect course for your Arabic and Quran journey.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}