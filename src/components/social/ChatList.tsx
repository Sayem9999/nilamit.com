'use client';

import React from 'react';
import { MessageSquare, ArrowRight, User, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatRelativeTime } from '@/lib/format';
import { useTranslations } from 'next-intl';

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

export default function ChatList({ conversations, currentUserId }: ChatListProps) {
  const t = useTranslations('Social');

  if (!conversations || conversations.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-[40px] p-12 text-center h-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('noChats')}</h3>
        <p className="text-sm text-gray-400 max-w-xs">{t('advanceGated')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-[40px] p-6 shadow-premium overflow-hidden">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('activeChats')}</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Transaction Coordination</p>
        </div>
        <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
           <MessageSquare className="w-5 h-5 text-primary-500" />
        </div>
      </div>

      <div className="space-y-4">
        {conversations.map((convo) => {
          const isBuyer = convo.buyerId === currentUserId;
          const recipient = isBuyer ? convo.auction.seller : convo.auction.winner;
          const lastMsg = convo.messages[0];

          return (
            <Link 
              key={convo.id} 
              href={`/auctions/${convo.auctionId}`}
              className="flex items-start gap-4 p-4 rounded-3xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-100 relative overflow-hidden flex-shrink-0">
                {convo.auction.images?.[0] ? (
                  <Image src={convo.auction.images[0]} alt={convo.auction.title} fill className="object-cover" />
                ) : (
                  <ShoppingBag className="w-6 h-6 text-gray-300 m-auto mt-4" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-gray-900 truncate pr-4">
                    {convo.auction.title}
                  </h4>
                  {lastMsg && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      {formatRelativeTime(new Date(lastMsg.createdAt))}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-gray-200 relative overflow-hidden">
                    {recipient?.image ? (
                        <Image src={recipient.image} alt={recipient.name || ""} fill className="object-cover" />
                    ) : (
                        <User className="w-3 h-3 text-gray-400 m-auto" />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                    {recipient?.name}
                  </span>
                </div>

                <p className="text-xs text-gray-500 truncate italic">
                  {lastMsg ? lastMsg.content : "No messages yet"}
                </p>
              </div>

              <div className="self-center">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <ArrowRight className="w-4 h-4 text-gray-900" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
