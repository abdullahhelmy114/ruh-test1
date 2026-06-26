"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { T } from "@/components/TranslatedText";
import { Shield, RefreshCw, Check } from "lucide-react";

interface CustomCaptchaProps {
  onVerify: (token: string) => void;
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const op = Math.random() > 0.5 ? "+" : "×";
  const answer = op === "+" ? a + b : a * b;
  return {
    question: `${a} ${op} ${b} = ?`,
    answer: answer.toString(),
    id: Date.now().toString(36),
  };
}

export function CustomCaptcha({ onVerify }: CustomCaptchaProps) {
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [userAnswer, setUserAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleVerify = () => {
    if (userAnswer === captcha.answer) {
      setStatus("success");
      onVerify(`custom-captcha-${captcha.id}-verified`);
    } else {
      setStatus("error");
      setTimeout(() => {
        setCaptcha(generateCaptcha());
        setUserAnswer("");
        setStatus("idle");
        inputRef.current?.focus();
      }, 1000);
    }
  };

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setUserAnswer("");
    setStatus("idle");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "relative overflow-hidden rounded-2xl border p-5",
            status === "success"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : status === "error"
              ? "border-red-500/30 bg-red-500/5"
              : "border-border/50 bg-card/30 glass"
          )}
        >
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div
              className={cn(
                "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl",
                status === "success"
                  ? "bg-emerald-500/20"
                  : status === "error"
                  ? "bg-red-500/20"
                  : "bg-amber-500/10"
              )}
            />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-secondary-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <T>Human Verification</T>
              </span>
            </div>
            <button
              onClick={refreshCaptcha}
              className="p-1 rounded-full hover:bg-accent transition-colors"
              title="Refresh captcha"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="mb-4 text-center select-none">
            <div className="inline-block rounded-xl bg-muted/50 px-6 py-3">
              <span className="text-2xl font-mono font-bold tracking-widest text-foreground select-none">
                {captcha.question.split("").map((char, i) => (
                  <span
                    key={i}
                    className={cn(
                      char === "?" ? "text-secondary-foreground" : "",
                      "select-none"
                    )}
                    style={{
                      transform: `rotate(${Math.random() * 4 - 2}deg)`,
                      display: "inline-block",
                    }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </span>
                ))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              id="captcha-answer"
              name="captcha-answer"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value);
                setStatus("idle");
              }}
              onKeyDown={handleKeyDown}
              placeholder="?"
              className={cn(
                "flex-1 rounded-xl border bg-background px-4 py-2.5 text-center text-lg font-semibold outline-none transition-all",
                status === "success"
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : status === "error"
                  ? "border-red-500 ring-2 ring-red-500/20 animate-shake"
                  : "border-border focus:ring-2 focus:ring-amber-500/30"
              )}
              disabled={status === "success"}
            />
            <button
              onClick={handleVerify}
              disabled={!userAnswer || status === "success"}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50",
                status === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-black hover:bg-amber-400"
              )}
            >
              {status === "success" ? (
                <Check className="h-4 w-4" />
              ) : (
                <T>Verify</T>
              )}
            </button>
          </div>

          {status === "error" && (
            <p className="mt-2 text-xs text-red-500 text-center">
              <T>Incorrect answer. Try again!</T>
            </p>
          )}
          {status === "success" && (
            <p className="mt-2 text-xs text-emerald-500 text-center">
              <T>Verified successfully!</T>
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}