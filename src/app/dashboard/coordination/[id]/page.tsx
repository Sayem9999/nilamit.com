import { auth } from "@/lib/auth";
import { db, toMessage } from "@/lib/db";
import { AuctionService } from "@/services/auction/auction-service";
import { notFound, redirect } from "next/navigation";
import ChatInterface from "@/components/social/ChatInterface";
import { ChevronLeft, Info } from "lucide-react";
import Link from "next/link";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/actions/admin-content";
import { type Conversation, type EscrowTransaction, type Dispute } from "@/types";

export default async function CoordinationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const t = await getTranslations("Escrow");

  if (!session?.user) {
    redirect(`/login`);
  }

  const configRes = await getSystemConfig();
  const systemConfig = configRes.success ? configRes.data : null;

  const userId = session.user.id;

  const convSnap = await db.collection('conversations').doc(id).get();
  if (!convSnap.exists) {
    notFound();
  }
  const convData = convSnap.data() as Conversation;

  const auctionRes = await AuctionService.getById(convData.auctionId, userId);
  if (!auctionRes.success || !auctionRes.data) {
    notFound();
  }
  const auction = auctionRes.data;

  const escrowSnap = await db.collection('escrowTransactions').doc(convData.auctionId).get();
  let escrow: EscrowTransaction | null = null;
  if (escrowSnap.exists) {
    const rawEscrow = escrowSnap.data() as { createdAt?: unknown; updatedAt?: unknown; [key: string]: unknown };
    escrow = {
      ...rawEscrow,
      id: escrowSnap.id,
      createdAt: rawEscrow.createdAt
        ? (typeof (rawEscrow.createdAt as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (rawEscrow.createdAt as unknown as { toDate: () => Date }).toDate()
            : new Date(rawEscrow.createdAt as unknown as string | number | Date))
        : new Date(),
      updatedAt: rawEscrow.updatedAt
        ? (typeof (rawEscrow.updatedAt as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (rawEscrow.updatedAt as unknown as { toDate: () => Date }).toDate()
            : new Date(rawEscrow.updatedAt as unknown as string | number | Date))
        : new Date(),
    } as EscrowTransaction;
  }

  const disputeSnap = await db.collection('disputes').where('transactionId', '==', escrowSnap.id).get();
  let dispute: Dispute | null = null;
  if (!disputeSnap.empty) {
    const rawDispute = disputeSnap.docs[0].data() as { createdAt?: unknown; updatedAt?: unknown; [key: string]: unknown };
    dispute = {
      ...rawDispute,
      id: disputeSnap.docs[0].id,
      createdAt: rawDispute.createdAt
        ? (typeof (rawDispute.createdAt as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (rawDispute.createdAt as unknown as { toDate: () => Date }).toDate()
            : new Date(rawDispute.createdAt as unknown as string | number | Date))
        : new Date(),
      updatedAt: rawDispute.updatedAt
        ? (typeof (rawDispute.updatedAt as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (rawDispute.updatedAt as unknown as { toDate: () => Date }).toDate()
            : new Date(rawDispute.updatedAt as unknown as string | number | Date))
        : new Date(),
    } as Dispute;
  }

  const messagesSnap = await db.collection('messages').where('conversationId', '==', id).orderBy('createdAt', 'asc').get();
  const messages = messagesSnap.docs.map(d => toMessage(d.id, d.data()));

  const conversation = {
    ...convData,
    id: convSnap.id,
    auction: {
      ...auction,
      escrowTransaction: escrow ? { ...escrow, id: escrowSnap.id, dispute } : null
    },
    messages
  };

  if (!conversation) {
    notFound();
  }

  // Ensure user is part of the conversation
  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    redirect(`/dashboard`);
  }

  // Ensure escrow is active (not refunded)
  const escrowStatus = conversation.auction.escrowTransaction?.status;
  if (!escrowStatus || escrowStatus === 'REFUNDED') {
     // If refunded, redirect back to dashboard
     redirect(`/dashboard`);
  }

  const isBuyer = conversation.buyerId === userId;
  const recipient = isBuyer ? conversation.auction.seller : conversation.auction.winner;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={`/dashboard?tab=coordination`}
            className="p-2 bg-white rounded-md border border-gray-100 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">
              {t("coordinationTitle")}
            </h1>
            <p className="text-sm text-gray-500">{t("logisticsSupport")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Chat Area */}
          <div className="lg:col-span-2">
            <ChatInterface
              auctionId={conversation.auctionId}
              conversationId={conversation.id}
              initialMessages={conversation.messages.map((m) => ({
                ...m,
                createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString(),
              }))}
              recipientName={recipient?.name || "User"}
              recipientImage={recipient?.image || null}
            />
            
            <div className="mt-4 p-4 bg-amber-50 rounded-md border border-amber-100 flex gap-3 text-amber-800">
              <Info className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">{t("securityNote")}</span> {t("securityDesc")}
              </div>
            </div>
          </div>

          {/* Sidebar Tools */}
          <div className="space-y-6">
            <EscrowActionCard 
              transaction={{
                ...conversation.auction.escrowTransaction!,
                auction: {
                  title: conversation.auction.title,
                  seller: { name: conversation.auction.seller.name, image: conversation.auction.seller.image },
                  endTime: conversation.auction.endTime
                }
              }} 
              treasuryNumbers={{
                bkash: systemConfig?.treasuryBkash || "017XXXXXXXX",
                nagad: systemConfig?.treasuryNagad || "018XXXXXXXX"
              }}
              layout="vertical"
            />

            <div className="bg-primary-900 text-white p-6 rounded-[32px] shadow-xl overflow-hidden relative">
               <div className="relative z-10">
                 <h4 className="font-bold text-lg mb-2">{t("needHelp")}</h4>
                 <p className="text-sm opacity-80 mb-4">{t("helpDesc")}</p>
                 <Link 
                   href={`/support`}
                   className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-xs font-bold transition"
                 >
                   {t("guidelines")}
                 </Link>
               </div>
               <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary-500 rounded-full blur-3xl opacity-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
