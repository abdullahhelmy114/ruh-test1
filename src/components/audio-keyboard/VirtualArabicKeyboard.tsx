"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Delete, Keyboard } from "lucide-react";

interface VirtualArabicKeyboardProps {
  value: string;
  onChange: (value: string) => void;
}

const ARABIC_LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ",
  "د", "ذ", "ر", "ز", "س", "ش", "ص",
  "ض", "ط", "ظ", "ع", "غ", "ف", "ق",
  "ك", "ل", "م", "ن", "ه", "و", "ي",
];

const HARAKAT = ["َ", "ُ", "ِ", "ْ", "ّ"];

export default function VirtualArabicKeyboard({
  value,
  onChange,
}: VirtualArabicKeyboardProps) {
  const [showHarakat, setShowHarakat] = useState(false);

  const append = (char: string) => {
    onChange(value + char);
  };

  const backspace = () => {
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    onChange("");
  };

  return (
    <div className="rounded-2xl border border-charcoal/10 bg-charcoal/95 p-4 shadow-2xl shadow-charcoal/30">
      {/* رأس الكيبورد */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-gold" />
          <span className="text-xs font-semibold uppercase tracking-widest text-cream">
            Arabic Keyboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHarakat((prev) => !prev)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showHarakat
                ? "bg-gold text-charcoal"
                : "bg-charcoal/80 text-cream/70 hover:bg-charcoal/60"
            }`}
          >
            Tashkeel
          </button>
          <button
            onClick={clear}
            className="rounded-full px-3 py-1 text-xs font-medium text-cream/70 transition-colors hover:bg-charcoal/60"
          >
            Clear
          </button>
        </div>
      </div>

      {/* منطقة الحروف */}
      <div className="grid grid-cols-7 gap-1.5" dir="rtl">
        {ARABIC_LETTERS.map((letter) => (
          <motion.button
            key={letter}
            whileTap={{ scale: 0.92 }}
            onClick={() => append(letter)}
            className="grid aspect-square place-items-center rounded-lg bg-charcoal/80 text-xl font-semibold text-cream transition-colors hover:bg-emerald-700 hover:text-white"
          >
            {letter}
          </motion.button>
        ))}
      </div>

      {/* الحركات */}
      <AnimatePresence>
        {showHarakat && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex justify-center gap-1.5" dir="rtl">
              {HARAKAT.map((haraka) => (
                <motion.button
                  key={haraka}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => append(haraka)}
                  className="grid h-10 w-14 place-items-center rounded-lg bg-charcoal/80 text-lg font-semibold text-gold transition-colors hover:bg-emerald-700 hover:text-white"
                >
                  {haraka}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* زر المسح */}
      <div className="mt-2 flex justify-end" dir="rtl">
        <button
          onClick={backspace}
          className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal/80 px-4 py-2 text-sm font-medium text-cream/80 transition-colors hover:bg-emerald-700 hover:text-white"
        >
          <Delete className="h-4 w-4" />
          Backspace
        </button>
      </div>
    </div>
  );
}