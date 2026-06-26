"use client";

import { T } from "@/components/TranslatedText";
import { Shield, Mail, UserPlus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

export default function PrivacyPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
      <div className="text-center mb-10">
        <Shield className="mx-auto h-12 w-12 text-accent-foreground mb-4" />
        <h1 className="font-serif text-4xl text-foreground"><T>Privacy Policy</T></h1>
        <p className="mt-2 text-muted-foreground"><T>Last updated: May 2026</T></p>
      </div>

      <div className="glass rounded-3xl p-8 md:p-10 shadow-lg space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="font-serif text-xl text-primary mb-2"><T>1. Information We Collect</T></h2>
          <p className="text-muted-foreground">
            <T>We collect personal information (name, email, phone number) when you register, enroll in courses, or contact us. We also collect technical data such as IP address and browser type for security and analytics purposes.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-primary mb-2"><T>2. How We Use Your Data</T></h2>
          <p className="text-muted-foreground">
            <T>Your data is used solely for: providing educational services, processing payments, sending course updates, improving our platform, and ensuring account security. We never sell your data to third parties.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-primary mb-2"><T>3. Data Storage & Protection</T></h2>
          <p className="text-muted-foreground">
            <T>All personal data is stored on secure servers encrypted at rest. Payment information is processed securely via PayPal and is not stored on our servers. We implement strict access controls and regular security audits.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-primary mb-2"><T>4. Your Rights</T></h2>
          <p className="text-muted-foreground">
            <T>You have the right to access, correct, or delete your data at any time. You may also request a copy of all information we hold about you. Contact us at the email below to exercise these rights.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-primary mb-2"><T>5. Cookies</T></h2>
          <p className="text-muted-foreground">
            <T>We use essential cookies for authentication and security. No tracking or advertising cookies are used. You can disable cookies in your browser settings, but some features may not function properly.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-primary mb-2"><T>6. Contact Us</T></h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Mail size={16} className="text-accent-foreground" />
            <T>For privacy concerns, contact us at:</T>
            <a href="mailto:info@ruhulqudus.com" className="text-accent-foreground hover:underline">info@ruhulqudus.com</a>
          </p>
        </section>
      </div>

      {/* أزرار الانضمام لغير المسجلين */}
      {!user && (
        <div className="mt-12 text-center">
          <div className="glass rounded-3xl p-8 inline-block">
            <UserPlus className="mx-auto h-12 w-12 text-accent-foreground mb-4" />
            <h2 className="font-serif text-2xl text-foreground mb-2"><T>Trust our platform?</T></h2>
            <p className="text-muted-foreground mb-6"><T>Join thousands of learners who trust us with their data.</T></p>
            <div className="flex justify-center gap-3">
              <Link href="/signup?role=student" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2">
                <T>Join as Student</T> <ArrowRight size={16} />
              </Link>
              <Link href="/signup?role=teacher" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 inline-flex items-center gap-2">
                <T>Join as Teacher</T> <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-accent-foreground underline">
          <T>Back to Home</T>
        </Link>
      </div>
    </div>
  );
}