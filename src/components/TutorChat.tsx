'use client';

import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TutorChatProps {
  context: 'onboarding' | 'sales' | 'dashboard';
  userLevel?: string;
  userGoal?: string;
  userName?: string;
  userId?: string;
  language?: string; // 'en' | 'tr' | 'it' | 'es' | 'ar'
  onEvaluationComplete?: (assessment: any, fullReply: string) => void;
}

export default function TutorChat({
  context,
  userLevel,
  userGoal,
  userName,
  userId,
  language = 'en',
  onEvaluationComplete,
}: TutorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const newMessages = [...messages, { role: 'user' as const, content }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages,
          context,
          userLevel,
          userGoal,
          userName,
          userId,
          language,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: 'Sorry, an error occurred. Please try again.' }]);
      } else {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        if (data.assessment && onEvaluationComplete) {
          onEvaluationComplete(data.assessment, data.reply);
        }
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Unable to connect to the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = () => {
    setStarted(true);
    sendMessage('Hello, I want to start.');
  };

  // ─── شاشة البداية ───
  if (!started) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 p-8 text-center backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-primary" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-gold" />
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-gold">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <h3 className="mt-4 font-serif text-2xl font-bold text-foreground">Your Smart Arabic Teacher</h3>
          <p className="mt-2 text-muted-foreground">Will help you determine your level and choose the right course.</p>
          <button
            onClick={startConversation}
            className="mt-6 rounded-full px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 bg-gradient-to-r from-primary to-gold"
          >
            Start Conversation
          </button>
        </div>
      </div>
    );
  }

  // ─── واجهة المحادثة ───
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/80 backdrop-blur-xl" style={{ height: '600px' }}>
      {/* الرأس */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 bg-gradient-to-r from-primary/10 to-gold/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-gold">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-foreground">Arabic Teacher</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
        </div>
        <button
          onClick={() => setStarted(false)}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted/50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* الرسائل */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-primary to-gold text-primary-foreground'
                  : 'bg-muted/50 text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
              Teacher is writing...
            </div>
          </div>
        )}
      </div>

      {/* الإدخال */}
      <div className="border-t border-border/50 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 rounded-full border border-border/50 bg-background/50 px-5 py-3 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/60"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-gold text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}