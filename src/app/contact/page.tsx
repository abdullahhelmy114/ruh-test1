import type { Metadata } from "next";
import { ContactContent } from "./ContactContent";

export const metadata: Metadata = {
  title: "Contact Us – Ruhulqudus Academy",
  description:
    "Get in touch with Ruhulqudus Academy. We are here to help you on your Quranic journey. Reach out for support, partnerships, or general inquiries.",
  openGraph: {
    title: "Contact Us – Ruhulqudus Academy",
    description:
      "Have questions about our courses or need help? Contact our dedicated team. We respond within 24 hours.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

export default function ContactPage() {
  return <ContactContent />;
}