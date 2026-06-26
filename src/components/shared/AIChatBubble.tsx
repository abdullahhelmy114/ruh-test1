"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Send, X, Sparkles, Loader2 } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string };

const SYSTEM_PROMPT = `You are Nūr, an elite AI assistant for Ruhulqudus Academy, a prestigious Arabic language institution. 
Your role is to help students, teachers, and administrators with:
- Arabic grammar, vocabulary, and translation.
- Navigating the academy platform (login, courses, profiles, dashboard).
- Providing cultural and academic insights.
Always respond in a warm, respectful, and knowledgeable tone. If asked in Arabic, reply in Arabic; otherwise use English.`;

export function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "أهلاً وسهلاً! I'm Nūr, your Arabic learning companion. How can I assist you today?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // التمرير التلقائي إلى آخر رسالة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const userMsg: Msg = { role: "user", text: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // تحويل كل الرسائل السابقة + رسالة النظام إلى تنسيق OpenAI
      const apiMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.text,
        })),
        { role: "user", content: prompt },
      ];

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error("AI request failed");

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
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
            className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-3xl border bg-card shadow-elegant"
          >
            <div className="flex items-center justify-between gradient-emerald px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-serif text-base leading-tight">Nūr · AI Assistant</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-70">Always here to help</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/10">
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

            <div className="border-t p-3">
              <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Ask in English or العربية..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  onClick={send}
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
        className="fixed bottom-6 right-6 z-50 grid h-16 w-16 place-items-center rounded-full gradient-emerald shadow-elegant ring-4 ring-gold/30"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
        <Brain className="relative h-7 w-7 text-primary-foreground" />
      </motion.button>
    </>
  );
}