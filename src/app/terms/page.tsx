"use client";

import { T } from "@/components/TranslatedText";
import { FileText, AlertTriangle, ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

export default function TermsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
      <div className="text-center mb-10">
        <FileText className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
        <h1 className="font-serif text-4xl"><T>Terms of Service</T></h1>
        <p className="mt-2 text-muted-foreground"><T>Last updated: May 2026</T></p>
      </div>

      <div className="glass rounded-3xl p-8 md:p-10 shadow-elegant space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="font-serif text-xl text-accent-foreground mb-2"><T>1. Acceptance of Terms</T></h2>
          <p className="text-muted-foreground">
            <T>By using Ruhulqudus Academy, you agree to these terms. If you do not agree, please discontinue use of our services immediately.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-accent-foreground mb-2"><T>2. User Accounts</T></h2>
          <p className="text-muted-foreground">
            <T>You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate and complete information during registration. Sharing accounts is strictly prohibited.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-accent-foreground mb-2"><T>3. Payments & Refunds</T></h2>
          <p className="text-muted-foreground">
            <T>All purchases are final unless otherwise stated. Refund requests are evaluated on a case-by-case basis within 7 days of purchase. Contact us for refund inquiries.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-accent-foreground mb-2"><T>4. Intellectual Property</T></h2>
          <p className="text-muted-foreground">
            <T>All course materials, videos, and content are the exclusive property of Ruhulqudus Academy and its instructors. Redistribution, copying, or reselling is prohibited.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-accent-foreground mb-2"><T>5. Code of Conduct</T></h2>
          <p className="text-muted-foreground">
            <T>Respectful behavior is required at all times. Harassment, cheating, or any form of misconduct will result in immediate account suspension without refund.</T>
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-accent-foreground mb-2"><T>6. Limitation of Liability</T></h2>
          <p className="text-muted-foreground flex items-start gap-2">
            <AlertTriangle size={16} className="text-secondary-foreground shrink-0 mt-0.5" />
            <T>Ruhulqudus Academy is not liable for any indirect damages arising from the use of our platform. Services are provided "as is" without warranty.</T>
          </p>
        </section>
      </div>

      {/* أزرار الانضمام لغير المسجلين */}
      {!user && (
        <div className="mt-12 text-center">
          <div className="glass rounded-3xl p-8 inline-block">
            <UserPlus className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2"><T>Ready to join our community?</T></h2>
            <p className="text-muted-foreground mb-6"><T>Create an account and start your Arabic journey today.</T></p>
            <div className="flex justify-center gap-3">
              <Link href="/signup?role=student" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 inline-flex items-center gap-2">
                <T>Join as Student</T> <ArrowRight size={16} />
              </Link>
              <Link href="/signup?role=teacher" className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 inline-flex items-center gap-2">
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