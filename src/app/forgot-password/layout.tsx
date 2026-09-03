import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | Ruh-Ul-Qudus Academy",
  description: "Reset your Ruh-Ul-Qudus Academy password securely to regain access to your courses.",
  alternates: { canonical: "https://ruhulqudus.com/forgot-password" },
  openGraph: {
    title: "Forgot Password | Ruh-Ul-Qudus Academy",
    description: "Reset your password securely.",
    url: "https://ruhulqudus.com/forgot-password",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Forgot Password" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Forgot Password | Ruh-Ul-Qudus Academy",
    description: "Reset your password securely.",
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