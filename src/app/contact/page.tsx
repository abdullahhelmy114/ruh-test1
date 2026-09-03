import type { Metadata } from "next";
import { ContactContent } from "./ContactContent";

export const metadata: Metadata = {
  title: "Contact Us | Ruh-Ul-Qudus Academy",
  description: "Get in touch with Ruh-Ul-Qudus Academy for inquiries about Arabic courses, Quran programs, and support.",
  alternates: { canonical: "https://ruhulqudus.com/contact" },
  openGraph: {
    title: "Contact Ruh-Ul-Qudus Academy",
    description: "We're here to help. Reach out for any questions about our Arabic and Quran programs.",
    url: "https://ruhulqudus.com/contact",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Contact Ruh-Ul-Qudus Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Ruh-Ul-Qudus Academy",
    description: "We're here to help. Reach out for any questions.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};

export default function ContactPage() {
  return <ContactContent />;
}