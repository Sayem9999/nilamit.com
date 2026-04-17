import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import ChatInterface from "@/components/social/ChatInterface";
import { ChevronLeft, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/actions/admin-content";

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(v as string);
}

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

  const convSnap = await db.collection("conversations").doc(id).get();
  if (!convSnap.exists) notFound();
  const convData = convSnap.data()!;

  if (convData.buyerId !== userId && convData.sellerId !== userId) {
    redirect(`/${locale}/dashboard`);
  }

  const auctionId = convData.auctionId as string;
  const [aucSnap, escrowSnap, messagesSnap] = await Promise.all([
    db.collection("auctions").doc(auctionId).get(),
    db.collection("escrowTransactions").doc(auctionId).get(),
    db.collection("messages")
      .where("conversationId", "==", id)
      .orderBy("createdAt", "asc")
      .get(),
  ]);
  if (!aucSnap.exists) notFound();
  const aucData = aucSnap.data()!;

  const escrowData = escrowSnap.exists ? escrowSnap.data()! : null;
  let dispute: FirebaseFirestore.DocumentData | null = null;
  if (escrowData) {
    const dispSnap = await db.collection("disputes")
      .where("transactionId", "==", escrowSnap.id)
      .limit(1)
      .get();
    const d = dispSnap.docs[0];
    dispute = d ? { id: d.id, ...d.data() } : null;
  }

  const escrowStatus = escrowData?.status as string | undefined;
  if (!escrowStatus || (escrowStatus !== "HELD" && escrowStatus !== "DISPUTED" && escrowStatus !== "RELEASED")) {
    redirect(`/${locale}/dashboard?tab=escrow`);
  }

  const sellerId = aucData.sellerId as string;
  const winnerId = aucData.winnerId as string | null | undefined;
  const [sellerSnap, winnerSnap] = await Promise.all([
    db.collection("users").doc(sellerId).get(),
    winnerId ? db.collection("users").doc(winnerId).get() : Promise.resolve(null),
  ]);
  const sellerData = sellerSnap.data() ?? {};
  const winnerData = winnerSnap?.exists ? winnerSnap.data() ?? {} : null;

  const conversation = {
    id,
    auctionId,
    buyerId:  convData.buyerId,
    sellerId: convData.sellerId,
    auction: {
      id:          auctionId,
      title:       aucData.title,
      endTime:     toDate(aucData.endTime),
      seller: { id: sellerId, name: sellerData.name ?? null, image: sellerData.image ?? null },
      winner: winnerData && winnerId
        ? { id: winnerId, name: winnerData.name ?? null, image: winnerData.image ?? null }
        : null,
      escrowTransaction: escrowData
        ? { ...escrowData, id: escrowSnap.id, dispute }
        : null,
    },
    messages: messagesSnap.docs.map(d => {
      const m = d.data();
      return { ...m, id: d.id, createdAt: toDate(m.createdAt) };
    }),
  };

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
              })) as any}
              recipientName={recipient?.name || "User"}
              recipientImage={recipient?.image ?? null}
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
                 
                } as any} 
                treasuryNumbers={{
                  bkash: systemConfig.treasuryBkash ?? null,
                  nagad: systemConfig.treasuryNagad ?? null
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
