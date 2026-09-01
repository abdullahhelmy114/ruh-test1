'use client';

import { useState } from 'react';

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
  onEvaluationComplete?: (assessment: any, fullReply: string) => void;
}

export default function TutorChat({
  context,
  userLevel,
  userGoal,
  userName,
  userId,
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

  if (!started) {
    return (
      <div className="border rounded-lg p-6 max-w-2xl mx-auto text-center">
        <h3 className="text-xl font-bold mb-4">Your Smart Arabic Teacher</h3>
        <p className="mb-4">Will help you determine your level and choose the right course.</p>
        <button
          onClick={startConversation}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Start Conversation
        </button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 max-w-2xl mx-auto">
      <div className="h-80 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-100 text-left'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {loading && <div className="text-gray-500">Teacher is writing...</div>}
      </div>
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
          className="flex-1 p-2 border rounded"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}