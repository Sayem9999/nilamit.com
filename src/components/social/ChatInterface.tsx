'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { onChildAdded, ref } from 'firebase/database';
import { getClientDB, ensureFirebaseAuth } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendMessage, markAsRead } from '@/actions/chat';
import { Send, Check, CheckCheck, User, Camera, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { VerificationGuard } from '../auth/VerificationGuard';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  content: string;
  senderId: string;
  imageUrl?: string | null;
  isSystemMessage?: boolean;
  createdAt: Date | string;
  isRead?: boolean;
  /** Local-only flag: this message is still in-flight; show a dimmer state + spinner. */
  _pending?: boolean;
  /** Local-only flag: send failed; show retry affordance. */
  _failed?: boolean;
}

interface ChatInterfaceProps {
  auctionId: string;
  initialMessages: Message[];
  conversationId: string;
  recipientName: string;
  recipientImage?: string | null;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ChatInterface({
  initialMessages,
  conversationId,
  recipientName,
  recipientImage,
}: ChatInterfaceProps) {
  const { data: session } = useSession();
  const t = useTranslations('Social');

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track ids we've already rendered so RTDB echoes don't duplicate optimistic inserts.
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));

  const userId = session?.user?.id;

  // Auto-scroll to latest
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Realtime subscription ───────────────────────────────────────────
  // onChildAdded fires for every existing child on initial subscribe AND for new
  // children going forward. We dedupe by `seenIdsRef` so the initial backfill
  // doesn't duplicate `initialMessages` and our own optimistic inserts don't
  // double up when the server echo arrives.
  useEffect(() => {
    audioRef.current = new Audio('/sounds/gavel.mp3');
    let unsub: (() => void) | null = null;

    void (async () => {
      await ensureFirebaseAuth();
      const db = getClientDB();
      const convRef = ref(db, RTDB_PATHS.conversation(conversationId));

      unsub = onChildAdded(convRef, (snapshot) => {
        const data = snapshot.val();
        if (!data || data.event !== FIREBASE_EVENTS.NEW_MESSAGE) return;

        const incomingId = String(data.id ?? snapshot.key ?? '');
        if (!incomingId || seenIdsRef.current.has(incomingId)) {
          // Already rendered — either via initialMessages or optimistic insert.
          // Update isRead status if it changed.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === incomingId
                ? { ...m, isRead: data.isRead ?? m.isRead, _pending: false, _failed: false }
                : m,
            ),
          );
          return;
        }

        seenIdsRef.current.add(incomingId);
        const newMsg: Message = {
          id: incomingId,
          content: data.content ?? '',
          senderId: data.senderId ?? '',
          imageUrl: data.imageUrl ?? null,
          createdAt: data.createdAt ?? new Date().toISOString(),
          isRead: data.isRead,
        };
        setMessages((prev) => [...prev, newMsg]);

        if (newMsg.senderId !== userId) {
          audioRef.current?.play().catch(() => {});
          void markAsRead(conversationId);
        }
      });
    })();

    return () => {
      unsub?.();
    };
  }, [conversationId, userId]);

  // ─── Send ────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (e?: React.FormEvent, imageUrl?: string) => {
      if (e) e.preventDefault();
      const content = inputMessage.trim();
      if (!content && !imageUrl) return;
      if (!userId) return;

      // Optimistic insert — gives instant feedback even on slow networks.
      const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Message = {
        id: tempId,
        content,
        senderId: userId,
        imageUrl: imageUrl ?? null,
        createdAt: new Date().toISOString(),
        isRead: false,
        _pending: true,
      };
      seenIdsRef.current.add(tempId);
      setMessages((prev) => [...prev, optimistic]);
      setInputMessage('');
      setIsSending(true);

      const result = await sendMessage(conversationId, content, imageUrl);
      setIsSending(false);

      if (result.success && result.data) {
        // Server returned a real id — swap the temp message in place and track
        // the real id so the RTDB echo doesn't insert a duplicate.
        const realId = result.data.id;
        seenIdsRef.current.add(realId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, id: realId, _pending: false, createdAt: result.data!.createdAt }
              : m,
          ),
        );
      } else {
        // Mark the message as failed (kept in the thread with a retry pill).
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _failed: true } : m)),
        );
        toast.error(result.error?.message || t('sendFailed'));
        // Restore the input so the user can edit + retry without retyping.
        if (!imageUrl) setInputMessage(content);
      }
    },
    [inputMessage, conversationId, userId, t],
  );

  // ─── Image upload ────────────────────────────────────────────────────
  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!userId) return;
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast.error('Only JPG, PNG, WEBP, or GIF images are allowed.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error('Image must be under 2 MB.');
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'chat');

        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Upload failed');
        }
        const { url } = (await response.json()) as { url: string };
        await handleSend(undefined, url);
      } catch (err) {
        console.error('[Chat] Image upload failed:', err);
        toast.error(`${t('uploadFailed')} ${err instanceof Error ? err.message : ''}`);
      } finally {
        setIsUploading(false);
      }
    },
    [userId, handleSend, t],
  );

  return (
    <div className="flex flex-col h-[600px] bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 relative overflow-hidden flex items-center justify-center">
            {recipientImage ? (
              <Image
                src={recipientImage}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                referrerPolicy="no-referrer"
                unoptimized
              />
            ) : (
              <User className="w-5 h-5 text-primary-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{recipientName}</h3>
            {/* Removed fake "ONLINE" status — was always green, never reflected
                actual presence. Subtitle now shows the chat scope honestly. */}
            <p className="text-[11px] text-gray-500 mt-0.5">{t('coordinationChat')}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/40">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.senderId === userId;
            const isSystem = msg.isSystemMessage || msg.senderId === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <span className="px-3 py-1 bg-gray-100 text-[11px] font-semibold text-gray-500 rounded-full uppercase tracking-wide">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: msg._pending ? 0.7 : 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'flex flex-col max-w-[80%]',
                  isMe ? 'ml-auto items-end' : 'mr-auto items-start',
                )}
              >
                <div
                  className={cn(
                    'px-3.5 py-2.5 rounded-md text-sm shadow-sm',
                    isMe
                      ? 'bg-gray-900 text-white rounded-tr-none'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none',
                    msg._failed && 'ring-1 ring-red-300',
                  )}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 relative rounded overflow-hidden border border-white/10 bg-black/5">
                      <Image
                        src={msg.imageUrl}
                        alt="Attachment"
                        width={400}
                        height={400}
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '300px',
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  )}
                  {msg.content && (
                    <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {msg._failed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                      <AlertCircle className="w-3 h-3" /> {t('failedToSend')}
                    </span>
                  )}
                  {msg._pending && (
                    <Loader2 className="w-3 h-3 text-gray-400 animate-spin" aria-label="Sending" />
                  )}
                  <span className="text-[11px] text-gray-400 font-medium">
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </span>
                  {isMe && !msg._pending && !msg._failed && (
                    msg.isRead ? (
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-gray-300" />
                    )
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <VerificationGuard>
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 bg-gray-50 rounded-md p-1.5 border border-gray-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImageUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
              className="p-2 hover:bg-white rounded-md transition-colors disabled:opacity-40"
              title="Attach image"
              aria-label="Attach image"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-gray-500" />
              )}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t('typeMessage')}
              className="flex-1 bg-transparent border-none text-sm focus:ring-0 focus:outline-none placeholder:text-gray-400"
              disabled={isSending || isUploading}
              maxLength={2000}
            />

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !isUploading) || isSending}
              className="w-10 h-10 bg-primary-600 hover:bg-primary-700 rounded-md flex items-center justify-center text-white disabled:opacity-40 disabled:scale-95 transition-all"
              aria-label="Send"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </VerificationGuard>
      </div>
    </div>
  );
}
