"use client";

import { X, CreditCard, MessageCircleMore, Copy, Check } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { useState } from "react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle: string;
  userEmail?: string | null;
}

export function PaymentModal({ isOpen, onClose, courseTitle, userEmail }: PaymentModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // ⚠️ قم بتغيير هذا إلى رقم IBAN الحقيقي الخاص بك
  const IBAN = "IBAN NUMARA";

  // ⚠️ رقم الواتساب (بصيغة دولية بدون + أو 00)
  const WHATSAPP_NUMBER = "905518998716";

  const whatsappMessage = encodeURIComponent(
    `Hello,\nI would like to activate the course: ${courseTitle}\nRegistered email: ${userEmail || "..."}\n\nAttached is the payment receipt.`
  );
  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`;

  const copyIBAN = () => {
    navigator.clipboard.writeText(IBAN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass bg-card border border-gray-200/80 rounded-3xl shadow-2xl max-w-lg w-full p-8 relative animate-in zoom-in-95 duration-200">
        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-emerald-100 text-gray-500 transition-colors"
        >
          <X size={20} />
        </button>

        {/* العنوان */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-primary mb-4">
            <CreditCard size={28} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">
            <T>Complete Your Purchase</T>
          </h2>
          <p className="text-sm text-gray-500 mt-2">{courseTitle}</p>
        </div>

        {/* خيار 1: IBAN */}
        <div className="mb-6 p-5 rounded-2xl bg-emerald-100/30 border border-gray-200/50">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <T>Option 1: Bank Transfer (IBAN)</T>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            <T>Transfer the amount to the following IBAN, then send us the receipt via WhatsApp:</T>
          </p>
          <div className="flex items-center gap-2 bg-background rounded-xl p-3 border border-gray-200">
            <code className="flex-1 text-sm font-mono font-bold text-gray-900 select-all">{IBAN}</code>
            <button
              onClick={copyIBAN}
              className="p-2 rounded-lg hover:bg-emerald-100 transition-colors text-gray-500 hover:text-gray-900"
              title="Copy IBAN"
            >
              {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-primary mt-2 font-medium">
              <T>IBAN copied successfully</T>
            </p>
          )}
        </div>

        {/* خيار 2: واتساب */}
        <div className="p-5 rounded-2xl bg-accent/20 border border-accent/30">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MessageCircleMore size={18} className="text-accent" />
            <T>Option 2: Contact via WhatsApp</T>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            <T>Send your payment receipt or ask any questions via WhatsApp. Your course will be activated immediately.</T>
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 w-full justify-center rounded-full bg-amber-100text-amber-700 py-3 text-sm font-semibold hover:bg-accent/90 transition-colors shadow-md"
          >
            <MessageCircleMore size={18} />
            <T>Contact via WhatsApp</T>
          </a>
        </div>
      </div>
    </div>
  );
}