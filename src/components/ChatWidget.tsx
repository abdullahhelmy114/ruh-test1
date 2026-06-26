"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Send, MessageCircle, X } from "lucide-react";
import { T } from "@/components/TranslatedText";

export function ChatWidget({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    const channel = pusher.subscribe(roomId);
    channel.bind("message", (data: any) => {
      setMessages((prev) => [...prev, data]);
    });
    return () => { pusher.unsubscribe(roomId); };
  }, [roomId, open]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !user) return;
    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomId, message: text, user: user.email?.split("@")[0] }),
    });
    setText("");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="glass rounded-3xl shadow-2xl w-80 h-112.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-serif text-lg"><T>Live Chat</T></h3>
            <button onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.user === user?.email?.split("@")[0] ? "text-right" : ""}`}>
                <span className="font-semibold text-accent-foreground">{m.user}</span>
                <div className="bg-accent/50 rounded-2xl px-3 py-1.5 inline-block max-w-[80%]">{m.message}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type..." className="flex-1 rounded-full border bg-background px-4 py-2 text-sm" />
            <button onClick={sendMessage} className="rounded-full bg-amber-500 p-2 text-black"><Send size={16} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="rounded-full bg-amber-500 p-4 text-black shadow-xl hover:bg-amber-400">
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}