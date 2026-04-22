import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import ChatInterface from "@/components/social/ChatInterface";
import { ChevronLeft, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/actions/admin-content";

export default async function CoordinationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const session = await auth();
  const t = await getTranslations("Escrow");

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const systemConfig = await getSystemConfig();

  const userId = session.user.id;

  const convSnap = await db.collection('conversations').doc(id).get();
  if (!convSnap.exists) {
    notFound();
  }
  const convData = convSnap.data()!;

  const auctionSnap = await db.collection('auctions').doc(convData.auctionId).get();
  const auction = auctionSnap.data()!;

  const sellerSnap = await db.collection('users').doc(auction.sellerId).get();
  const seller = sellerSnap.data()!;

  const winnerSnap = await db.collection('users').doc(auction.winnerId || 'unknown').get();
  const winner = winnerSnap.exists ? winnerSnap.data()! : {};

  const escrowSnap = await db.collection('escrowTransactions').doc(convData.auctionId).get();
  const escrow = escrowSnap.exists ? escrowSnap.data()! : null;

  const disputeSnap = await db.collection('disputes').where('transactionId', '==', escrowSnap.id).get();
  const dispute = disputeSnap.empty ? null : disputeSnap.docs[0].data();

  const messagesSnap = await db.collection('messages').where('conversationId', '==', id).orderBy('createdAt', 'asc').get();
  const messages = messagesSnap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate?.() || new Date(d.data().createdAt) }));

  const conversation: any = {
    ...convData,
    id: convSnap.id,
    auction: {
      ...auction,
      id: auctionSnap.id,
      seller: { id: auction.sellerId, name: seller.name, image: seller.image },
      winner: { id: auction.winnerId, name: winner.name, image: winner.image },
      escrowTransaction: escrow ? { ...escrow, id: escrowSnap.id, dispute } : null
    },
    messages
  };

  if (!conversation) {
    notFound();
  }

  // Ensure user is part of the conversation
  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    redirect(`/${locale}/dashboard`);
  }

  // Ensure escrow is HELD or DISPUTED (Post-advance coordination)
  const escrowStatus = conversation.auction.escrowTransaction?.status;
  if (!escrowStatus || (escrowStatus !== 'HELD' && escrowStatus !== 'DISPUTED' && escrowStatus !== 'RELEASED')) {
     // If not yet advanced, redirect back to dashboard escrow tab
     redirect(`/${locale}/dashboard?tab=escrow`);
  }

  const isBuyer = conversation.buyerId === userId;
  const recipient = isBuyer ? conversation.auction.seller : conversation.auction.winner;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href={`/${locale}/dashboard?tab=coordination`}
            className="p-2 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition"
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
              initialMessages={conversation.messages.map((m: any) => ({
                ...m,
                createdAt: m.createdAt.toISOString(),
              }))}
              recipientName={recipient?.name || "User"}
              recipientImage={recipient?.image || null}
            />
            
            <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800">
              <Info className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">{t("securityNote")}</span> {t("securityDesc")}
              </div>
            </div>
          </div>

          {/* Sidebar Tools */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-sm uppercase tracking-wider">{t("shieldActive")}</h3>
              </div>
              
              <EscrowActionCard 
                transaction={{
                  ...(conversation.auction.escrowTransaction as object),
                  auction: {
                    title: conversation.auction.title,
                    seller: { name: conversation.auction.seller.name },
                    endTime: conversation.auction.endTime
                  }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any} 
                treasuryNumbers={{
                  bkash: systemConfig?.treasuryBkash || "017XXXXXXXX",
                  nagad: systemConfig?.treasuryNagad || "018XXXXXXXX"
                }}
              />
            </div>

            <div className="bg-primary-900 text-white p-6 rounded-[32px] shadow-xl overflow-hidden relative">
               <div className="relative z-10">
                 <h4 className="font-bold text-lg mb-2">{t("needHelp")}</h4>
                 <p className="text-sm opacity-80 mb-4">{t("helpDesc")}</p>
                 <Link 
                   href={`/${locale}/support`}
                   className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
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
