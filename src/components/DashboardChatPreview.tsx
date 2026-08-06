'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Message {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string };
}

export default function DashboardChatPreview() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    fetch('/api/team-chat')
      .then((r) => r.json())
      .then((d) => setMessages((d.messages || []).slice(-3)));
  }, []);

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-900">Team Chat</h2>
        <Link href="/team-chat" className="text-xs font-medium text-brand-700 hover:underline">
          Open full chat →
        </Link>
      </div>
      {messages.length === 0 ? (
        <p className="text-sm text-slate-400">No messages yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {messages.map((m) => (
            <li key={m.id} className="text-slate-600">
              <span className="font-medium text-slate-800">{m.sender.name}:</span> {m.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

