"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { Loader2, Mail, Send, User } from "lucide-react";

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/messages?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSendReply = async () => {
    if (!replyTo || !replyText.trim()) return;
    setSending(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderUid: user?.uid, receiverUid: replyTo, message: replyText }),
    });
    setReplyTo(null);
    setReplyText("");
    setSending(false);
    // إعادة تحميل الرسائل
    const res = await fetch(`/api/messages?uid=${user?.uid}`);
    const data = await res.json();
    setMessages(data.messages || []);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-serif text-3xl mb-6"><T>Messages</T></h1>
      {messages.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Mail className="mx-auto h-12 w-12 mb-4 text-secondary-foreground/50" />
          <p><T>No messages yet.</T></p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`glass rounded-2xl p-4 ${!m.read ? 'border-l-4 border-l-amber-500' : ''}`}>
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-secondary-foreground" />
                <span className="font-medium">{m.sender_name}</span>
                <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm">{m.message}</p>
              <button onClick={() => { setReplyTo(m.sender_uid); setReplyText(""); }} className="mt-2 text-xs text-accent-foreground hover:underline">
                <T>Reply</T>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {replyTo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl p-6 max-w-md w-full shadow-elegant space-y-4">
            <h3 className="font-serif text-xl"><T>Reply</T></h3>
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} className="w-full rounded-2xl border bg-background p-4 text-sm" placeholder="Type your reply..." />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setReplyTo(null)} className="rounded-full border px-4 py-2 text-sm"><T>Cancel</T></button>
              <button onClick={handleSendReply} disabled={sending} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> <T>Send</T></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}