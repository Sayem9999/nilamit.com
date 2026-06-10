'use client';

import React from 'react';
import { MessageSquare, ArrowRight, User, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatRelativeTime } from '@/lib/format';
import { useTranslations } from 'next-intl';
import { getProxiedAvatarUrl } from '@/lib/avatar';

interface ConversationWithMeta {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  lastMessageAt: Date;
  auction: {
    id: string;
    title: string;
    images: string[];
  } | null;
  otherUser: {
    id: string;
    name: string | null;
    image: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: Date;
    isRead: boolean;
  } | null;
}

interface ChatListProps {
  conversations: ConversationWithMeta[];
}

export default function ChatList({ conversations }: ChatListProps) {
  const t = useTranslations('Social');

  if (!conversations || conversations.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 text-center h-full flex flex-col items-center justify-center shadow-sm">
        <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
          <MessageSquare className="w-7 h-7 text-gray-300" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1.5">{t('noChats')}</h3>
        <p className="text-sm text-gray-500 max-w-xs">{t('advanceGated')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-5 px-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-none">{t('activeChats')}</h2>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-1.5">
            Transaction Coordination
          </p>
        </div>
        <div className="w-9 h-9 bg-primary-50 rounded-md flex items-center justify-center">
          <MessageSquare className="w-4.5 h-4.5 text-primary-600" />
        </div>
      </div>

      <div className="space-y-1">
        {conversations.map((convo) => {
          const recipient = convo.otherUser;
          const lastMsg = convo.lastMessage;
          // Unread = there's a last message AND it's not from current user AND not read.
          // We don't have currentUserId here, but lastMessage.isRead from the server
          // already encodes "did the viewer read this" — if false, highlight.
          const unread = lastMsg ? lastMsg.isRead === false : false;

          return (
            // Fix: link to the chat page, not the auction page.
            // Conversations doc-id === auctionId (per data model), so we route
            // there to keep the URL stable across renames.
            <Link
              key={convo.id}
              href={`/dashboard/coordination/${convo.auctionId}`}
              className={`flex items-start gap-3 p-3 rounded-md transition-colors border group ${
                unread
                  ? 'bg-primary-50/50 border-primary-100 hover:bg-primary-50'
                  : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="w-12 h-12 rounded-md bg-gray-100 relative overflow-hidden flex-shrink-0">
                {convo.auction?.images?.[0] ? (
                  <Image
                    src={convo.auction.images[0]}
                    alt={convo.auction.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <h4 className="text-sm font-bold text-gray-900 truncate">
                    {convo.auction?.title || 'Auction Coordination'}
                  </h4>
                  {lastMsg && (
                    <span className="text-[11px] text-gray-500 font-medium shrink-0">
                      {formatRelativeTime(new Date(lastMsg.createdAt))}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-gray-200 relative overflow-hidden shrink-0">
                    {recipient?.image ? (
                      <Image
                        src={getProxiedAvatarUrl(recipient.image) || ''}
                        alt={recipient.name || ''}
                        fill
                        sizes="14px"
                        className="object-cover"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    ) : (
                      <User className="w-2.5 h-2.5 text-gray-400 m-auto" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 truncate">
                    {recipient?.name || 'Anonymous User'}
                  </span>
                </div>

                <p
                  className={`text-xs truncate ${
                    unread ? 'text-gray-900 font-semibold' : 'text-gray-500'
                  }`}
                >
                  {lastMsg ? lastMsg.content : 'No messages yet'}
                </p>
              </div>

              <div className="self-center flex items-center gap-2 shrink-0">
                {unread && (
                  <span
                    aria-label="Unread"
                    className="w-2 h-2 rounded-full bg-primary-600"
                  />
                )}
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
