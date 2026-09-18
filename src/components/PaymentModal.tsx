"use client";

import { X, CreditCard } from "lucide-react";
import { T } from "@/components/TranslatedText";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle: string;
  // Kept so callers need not change; nothing is sent anywhere.
  userEmail?: string | null;
}

// Whop is the academy's only payment channel and its checkout is not open
// yet. This modal used to ask for a bank transfer to a hard-coded IBAN and a
// receipt over WhatsApp, promising activation "immediately" — a manual
// channel the academy does not accept and nothing in the product could honour.
// It now says plainly that no payment is taken yet.
export function PaymentModal({ isOpen, onClose, courseTitle }: PaymentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="glass bg-card border border-border/80 rounded-3xl shadow-2xl max-w-lg w-full p-8 relative animate-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary text-muted-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <CreditCard size={28} />
          </div>
          <h2 id="payment-modal-title" className="font-serif text-2xl font-bold text-foreground">
            <T>Online payment is not open yet</T>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">{courseTitle}</p>
          <p className="text-sm text-muted-foreground mt-6">
            <T>Courses and subscriptions will be purchased through our secure Whop checkout. Until it opens, no payment is taken and nothing needs to be transferred.</T>
          </p>
          <button
            onClick={onClose}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <T>Close</T>
          </button>
        </div>
      </div>
    </div>
  );
}
