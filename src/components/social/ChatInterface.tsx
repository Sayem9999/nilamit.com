'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { onChildAdded, ref } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getClientDB, getClientStorage, ensureFirebaseAuth } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendMessage, markAsRead } from '@/actions/chat';
import { Send, Check, CheckCheck, User, Camera, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { VerificationGuard } from '../auth/VerificationGuard';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  senderId: string;
  imageUrl?: string | null;
  isSystemMessage?: boolean;
  createdAt: Date | string;
  isRead?: boolean;
}

interface ChatInterfaceProps {
  auctionId: string;
  initialMessages: Message[];
  conversationId: string;
  recipientName: string;
  recipientImage?: string | null;
}

export default function ChatInterface({
  auctionId,
  initialMessages,
  conversationId,
  recipientName,
  recipientImage,
}: ChatInterfaceProps) {
  const { data: session } = useSession();
  const t                 = useTranslations('Social');

  const [messages,     setMessages]     = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending,    setIsSending]    = useState(false);
  const [isUploading,  setIsUploading]  = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const startTimeRef   = useRef(Date.now());

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to new messages via Firebase RTDB
  useEffect(() => {
    audioRef.current = new Audio('/sounds/gavel.mp3');

    let unsub: (() => void) | null = null;

    void (async () => {
      await ensureFirebaseAuth();
      const db      = getClientDB();
      const convRef = ref(db, RTDB_PATHS.conversation(conversationId));

      unsub = onChildAdded(convRef, (snapshot) => {
        const data = snapshot.val();
        // Skip initial backfill and non-message events
        if (!data || data.event !== FIREBASE_EVENTS.NEW_MESSAGE) return;
        if (data._ts && data._ts < startTimeRef.current) return;

        const newMsg: Message = {
          id:        data.id ?? snapshot.key ?? uuidv4(),
          content:   data.content ?? '',
          senderId:  data.senderId ?? '',
          imageUrl:  data.imageUrl ?? null,
          createdAt: data.createdAt ?? new Date().toISOString(),
        };

        setMessages(prev => [...prev, newMsg]);

        if (newMsg.senderId !== session?.user?.id) {
          audioRef.current?.play().catch(() => {});
          markAsRead(conversationId);
        }
      });
    })();

    return () => { unsub?.(); };
  }, [conversationId, session?.user?.id]);

  // Upload image to Firebase Storage and send as message
  const handleImageUpload = async (file: File) => {
    if (!session?.user?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB.');
      return;
    }

    setIsUploading(true);
    try {
      await ensureFirebaseAuth();
      const storage  = getClientStorage();
      const path     = `chat/${session.user.id}/${uuidv4()}.${file.name.split('.').pop()}`;
      const fileRef  = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url      = await getDownloadURL(fileRef);
      await handleSend(undefined, url);
    } catch (err) {
      console.error('[Chat] Image upload failed:', err);
      alert(t('uploadFailed') + ' Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !imageUrl) return;

    setIsSending(true);
    const content = inputMessage;
    setInputMessage('');

    const result = await sendMessage(conversationId, content, imageUrl);
    if (!result.success) {
      console.error('[Chat] sendMessage failed', result.error?.message);
    }
    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-premium">
      {/* Header */}
      <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 relative overflow-hidden flex items-center justify-center">
            {recipientImage ? (
              <Image src={recipientImage} alt={recipientName} fill className="object-cover" />
            ) : (
              <User className="w-5 h-5 text-primary-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{recipientName}</h3>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{t('online')}</p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe     = msg.senderId === session?.user?.id;
            const isSystem = msg.isSystemMessage || msg.senderId === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="px-3 py-1 bg-gray-100 text-[10px] font-bold text-gray-500 rounded-full uppercase tracking-widest">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn('flex flex-col max-w-[80%]', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}
              >
                <div className={cn(
                  'px-4 py-3 rounded-2xl text-sm shadow-sm',
                  isMe ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none',
                )}>
                  {msg.imageUrl && (
                    <div className="mb-2 relative rounded-lg overflow-hidden border border-gray-100/10 bg-black/5">
                      <Image 
                        src={msg.imageUrl} 
                        alt="Attachment" 
                        width={400} 
                        height={400} 
                        style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[9px] text-gray-400 font-medium">
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </span>
                  {isMe && (
                    msg.isRead
                      ? <CheckCheck className="w-3 h-3 text-blue-500" />
                      : <Check className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <VerificationGuard>
          <form onSubmit={handleSend} className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
              disabled={isUploading}
              className="p-2 hover:bg-white rounded-xl transition-colors"
              title="Attach image"
            >
              {isUploading
                ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                : <Camera className="w-5 h-5 text-gray-500" />
              }
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t('typeMessage')}
              className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-gray-400 font-medium"
              disabled={isSending || isUploading}
            />

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !isUploading) || isSending}
              className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white hover:bg-gray-800 disabled:opacity-50 disabled:scale-95 transition-all shadow-lg shadow-gray-200"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </VerificationGuard>
      </div>
    </div>
  );
}
