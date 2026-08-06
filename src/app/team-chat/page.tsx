'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import NavBar from '@/components/NavBar';
import PageHeader from '@/components/PageHeader';

interface Message {
  id: string;
  body: string;
  attachmentUrl: string | null;
  attachmentFileName: string | null;
  createdAt: string;
  sender: { id: string; name: string };
}

export default function TeamChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInitial = useCallback(() => {
    fetch('/api/team-chat')
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages || []);
        if (d.messages && d.messages.length > 0) {
          lastFetchRef.current = d.messages[d.messages.length - 1].createdAt;
        }
      });
  }, []);

  const pollForNew = useCallback(() => {
    const since = lastFetchRef.current;
    const url = since ? `/api/team-chat?since=${encodeURIComponent(since)}` : '/api/team-chat';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages && d.messages.length > 0) {
          setMessages((prev) => [...prev, ...d.messages]);
          lastFetchRef.current = d.messages[d.messages.length - 1].createdAt;
        }
      });
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const interval = setInterval(pollForNew, 4000); // check for new messages every 4 seconds
    return () => clearInterval(interval);
  }, [pollForNew]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && !file) return;

    setSending(true);
    const formData = new FormData();
    formData.append('body', draft);
    if (file) formData.append('file', file);

    const res = await fetch('/api/team-chat', { method: 'POST', body: formData });
    const data = await res.json();
    setSending(false);

    if (res.ok) {
      setMessages((prev) => [...prev, data.message]);
      lastFetchRef.current = data.message.createdAt;
      setDraft('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <NavBar />
      <PageHeader title="Team Chat" subtitle="Quick internal messages between staff - not visible to consultants." />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="flex h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-400">No messages yet — say hi!</p>
            )}
            <div className="space-y-3">
              {messages.map((m) => {
                const isMe = m.sender.id === session?.user?.id;
                return (
                  <div key={m.id} className={isMe ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        isMe
                          ? 'max-w-[75%] rounded-2xl rounded-br-sm bg-gold-500 px-3 py-2 text-sm text-brand-900'
                          : 'max-w-[75%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800'
                      }
                    >
                      {!isMe && <p className="mb-0.5 text-xs font-semibold text-brand-700">{m.sender.name}</p>}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {m.attachmentUrl && (
                        <a
                          href={`/api/team-chat/${m.id}/attachment`}
                          target="_blank"
                          rel="noreferrer"
                          className={
                            isMe
                              ? 'mt-1 flex items-center gap-1 text-xs font-medium text-brand-900 underline'
                              : 'mt-1 flex items-center gap-1 text-xs font-medium text-brand-700 underline'
                          }
                        >
                          📎 {m.attachmentFileName}
                        </a>
                      )}
                      <p className={isMe ? 'mt-1 text-right text-xs text-brand-900/60' : 'mt-1 text-xs text-slate-400'}>
                        {new Date(m.createdAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-slate-200 p-3">
            {file && (
              <div className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                <span>📎 {file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <label className="flex cursor-pointer items-center rounded-full border border-slate-300 px-3 text-slate-500 hover:bg-slate-50">
                📎
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-gold-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !file)}
                className="rounded-full bg-gold-500 px-5 py-2 text-sm font-bold text-brand-900 hover:bg-gold-600 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

