import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | Ruh-Ul-Qudus Academy",
  description: "Set a new password for your Ruh-Ul-Qudus Academy account.",
  alternates: { canonical: "https://ruhulqudus.com/reset-password" },
  openGraph: {
    title: "Reset Password | Ruh-Ul-Qudus Academy",
    description: "Set a new password for your account.",
    url: "https://ruhulqudus.com/reset-password",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Reset Password" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reset Password | Ruh-Ul-Qudus Academy",
    description: "Set a new password for your account.",
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