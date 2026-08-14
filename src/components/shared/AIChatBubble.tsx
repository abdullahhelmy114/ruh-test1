"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Send, X, Sparkles, Loader2 } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string };

const SUGGESTIONS = [
  "كيف أجد الكورسات؟",
  "أي كورس يناسب مبتدئ؟",
  "ما هي أسعار الدورات؟",
  "أين أجد دوراتي المشترك فيها؟",
];

export function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "أهلاً بك! أنا نور، مساعدك في أكاديمية Ruh-Ul-Qudus. اسألني عن الدورات، الأسعار، أو أي شيء يخص المنصة.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || isLoading) return;

    const userMsg: Msg = { role: "user", text: prompt };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // بناء التاريخ بصيغة مناسبة للباك إند
      const history = newMessages
        .filter((m) => m.role !== "ai" || m.text !== newMessages[0]?.text) // نستثني رسالة الترحيب الافتراضية من التاريخ
        .slice(0, -1) // نزيل رسالة المستخدم الأخيرة لأنها سترسل كـ message
        .map((m) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.text,
        }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history,
        }),
      });

      if (!response.ok) throw new Error("AI request failed");

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "عذراً، حدث خطأ أثناء الاتصال بالمساعد. حاول مرة أخرى لاحقاً." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
            className="fixed bottom-24 right-6 z-50 flex h-[30rem] w-[22rem] flex-col overflow-hidden rounded-3xl border bg-card shadow-elegant"
          >
            <div className="flex items-center justify-between gradient-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-background/15 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-serif text-base leading-tight">Nūr · مساعد الموقع</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-70">أنا هنا لمساعدتك</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-background/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {messages.length === 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t p-3">
              <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="اسأل عن الكورسات، الأسعار، حسابك..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() => send()}
                  disabled={isLoading || !input.trim()}
                  className="grid h-8 w-8 place-items-center rounded-full gradient-gold disabled:opacity-50"
                >
                  <Send className="h-4 w-4 text-gold-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI Assistant"
        className="fixed bottom-6 right-6 z-50 grid h-16 w-16 place-items-center rounded-full gradient-primary shadow-elegant ring-4 ring-gold/30"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
        <Brain className="relative h-7 w-7 text-primary-foreground" />
      </motion.button>
    </>
  );
}