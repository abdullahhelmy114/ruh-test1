import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Course Bundles | Ruh-Ul-Qudus Academy",
  description: "Save with curated bundles of Arabic and Quran courses designed to take you from beginner to fluent.",
  alternates: { canonical: "https://ruhulqudus.com/bundles" },
  openGraph: {
    title: "Course Bundles | Ruh-Ul-Qudus Academy",
    description: "Save with our curated bundles of Arabic and Quran courses.",
    url: "https://ruhulqudus.com/bundles",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Course Bundles" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Course Bundles | Ruh-Ul-Qudus Academy",
    description: "Save with our curated bundles of Arabic and Quran courses.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}