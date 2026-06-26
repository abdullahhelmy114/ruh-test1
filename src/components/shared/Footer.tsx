import Link from "next/link";
import { T } from "@/components/TranslatedText";
import { Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4 md:px-8">
        {/* Brand */}
        <div>
          <Link href="/">
            <h3 className="font-serif text-xl hover:text-gold transition-colors">
              <T>Ruhulqudus Academy</T>
            </h3>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            <T>An elite digital institution for the Arabic language, founded by Dr. Jehan Ali Ahmed.</T>
          </p>
        </div>

        {/* Learn */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">
            <T>Learn</T>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/marketplace" className="hover:text-foreground transition-colors">
                <T>Courses</T>
              </Link>
            </li>
            <li>
              <Link href="/marketplace" className="hover:text-foreground transition-colors">
                <T>Bundles</T>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/student" className="hover:text-foreground transition-colors">
                <T>Live Classes</T>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/student" className="hover:text-foreground transition-colors">
                <T>Assessments</T>
              </Link>
            </li>
          </ul>
        </div>

        {/* Teach */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">
            <T>Teach</T>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/dashboard/teacher" className="hover:text-foreground transition-colors">
                <T>Certification</T>
              </Link>
            </li>
            <li>
              <Link href="/dashboard/teacher/courses/new" className="hover:text-foreground transition-colors">
                <T>Curriculum Tools</T>
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-foreground transition-colors">
                <T>Affiliate Program</T>
              </Link>
            </li>
          </ul>
        </div>

        {/* Academy */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gold">
            <T>Academy</T>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="#" className="hover:text-foreground transition-colors">
                <T>About Dr. Jehan</T>
              </Link>
            </li>
            <li>
              <Link href="/community" className="hover:text-foreground transition-colors">
                <T>Community</T>
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <Mail size={12} className="text-secondary-foreground" />
              <a href="mailto:info@ruhulqudus.com" className="hover:text-foreground transition-colors">
                <T>Contact</T>
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t py-6 text-center text-xs text-muted-foreground space-x-4">
        <span>© {new Date().getFullYear()} <T>Ruhulqudus Academy</T>. <T>All rights reserved</T>.</span>
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          <T>Privacy Policy</T>
        </Link>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          <T>Terms of Service</T>
        </Link>
      </div>
    </footer>
  );
}