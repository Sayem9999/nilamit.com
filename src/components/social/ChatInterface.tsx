'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { pusherClient } from '@/lib/pusher-client';
import { PUSHER_EVENTS } from '@/lib/pusher-server';
import { sendMessage, markAsRead } from '@/actions/chat';
import { Send, Image as ImageIcon, Check, CheckCheck, User, Camera, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Image from 'next/image';
import { UploadButton } from "@/lib/uploadthing";
import { cn } from '@/lib/utils';
import { VerificationGuard } from '../auth/VerificationGuard';

interface Message {
  id: string;
  content: string;
  senderId: string;
  imageUrl?: string | null;
  isSystemMessage?: boolean;
  createdAt: Date | string;
  isRead?: boolean;
}

interface ConversationWithMeta {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  auction: {
    title: string;
    images: string[];
    seller: { name: string | null; image: string | null };
    winner: { name: string | null; image: string | null } | null;
  };
  messages: {
    id: string;
    content: string;
    createdAt: Date;
  }[];
}

interface ChatListProps {
  conversations: ConversationWithMeta[];
  currentUserId: string;
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
  recipientImage
}: ChatInterfaceProps) {
  const { data: session } = useSession();
  const t = useTranslations('Social');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('/sounds/gavel.mp3'); // Mock sound for now
    
    const channel = pusherClient.subscribe(`private-convo-${conversationId}`);

    channel.bind(PUSHER_EVENTS.NEW_MESSAGE, (newMessage: Message) => {
      setMessages((prev) => [...prev, newMessage]);
      
      // Play sound if recipient is the one receiving
      if (newMessage.senderId !== session?.user?.id) {
         audioRef.current?.play().catch(() => {});
         // Mark as read if window is active (simplified)
         markAsRead(conversationId);
      }
    });

    return () => {
      pusherClient.unsubscribe(`private-convo-${conversationId}`);
    };
  }, [conversationId, session?.user?.id]);

  const handleSend = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !imageUrl) return;

    setIsSending(true);
    const content = inputMessage;
    setInputMessage('');

    const result = await sendMessage(auctionId, content, imageUrl);
    if (!result.success) {
      // Handle error (show toast)
      console.error(result.error);
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
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{t("online")}</p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.senderId === session?.user?.id;
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
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm shadow-sm",
                    isMe 
                      ? "bg-gray-900 text-white rounded-tr-none" 
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                  )}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 relative rounded-lg overflow-hidden border border-gray-100/10">
                      <img src={msg.imageUrl} alt="Attachment" className="max-w-full h-auto" />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[9px] text-gray-400 font-medium">
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </span>
                  {isMe && (
                    msg.isRead ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3 text-gray-300" />
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
            <div className="relative">
              <UploadButton
                endpoint="chatAttachment"
                onBeforeUploadBegin={(files) => {
                  setIsUploading(true);
                  return files;
                }}
                onClientUploadComplete={(res) => {
                  setIsUploading(false);
                  if (res?.[0]) {
                    handleSend(undefined, res[0].url);
                  }
                }}
                onUploadError={(error: Error) => {
                  setIsUploading(false);
                  alert(`${t("uploadFailed")} ${error.message}`);
                }}
                content={{
                  button({ isUploading }) {
                     return <Camera className={cn("w-5 h-5", isUploading ? "animate-pulse text-gray-400" : "text-gray-500")} />;
                  },
                  allowedContent() {
                     return null;
                  }
                }}
                appearance={{
                  button: "bg-transparent border-none p-2 hover:bg-white rounded-xl transition-colors cursor-pointer w-auto h-auto min-w-0 flex items-center justify-center",
                  allowedContent: "hidden"
                }}
              />
            </div>
            
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t("typeMessage")}
              className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-gray-400 font-medium"
              disabled={isSending || isUploading}
            />

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !isUploading) || isSending}
              className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white hover:bg-gray-800 disabled:opacity-50 disabled:scale-95 transition-all shadow-lg shadow-gray-200"
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
