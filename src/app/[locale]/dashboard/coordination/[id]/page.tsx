import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import ChatInterface from "@/components/social/ChatInterface";
import { ChevronLeft, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";

export default async function CoordinationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const userId = session.user.id;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      auction: {
        include: {
          seller: { select: { id: true, name: true, image: true } },
          winner: { select: { id: true, name: true, image: true } },
          escrowTransaction: {
            include: { dispute: true }
          }
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

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
              Coordination Hub
            </h1>
            <p className="text-sm text-gray-500">Logistics & Delivery Support</p>
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
                createdAt: m.createdAt.toISOString(),
              }))}
              recipientName={recipient?.name || "User"}
              recipientImage={recipient?.image}
            />
            
            <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800">
              <Info className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold">Security Note:</span> Please keep all payment discussions and delivery proof within this chat. This helps our team resolve disputes quickly if they arise. <b>Avoid external apps for coordination.</b>
              </div>
            </div>
          </div>

          {/* Sidebar Tools */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Escrow Shield Active</h3>
              </div>
              
              <EscrowActionCard transaction={conversation.auction.escrowTransaction as any} />
            </div>

            <div className="bg-primary-900 text-white p-6 rounded-[32px] shadow-xl overflow-hidden relative">
               <div className="relative z-10">
                 <h4 className="font-bold text-lg mb-2">Need Help?</h4>
                 <p className="text-sm opacity-80 mb-4">If the item doesn&apos;t match the description or shipment is delayed by more than 72 hours, you can raise a dispute.</p>
                 <Link 
                   href={`/${locale}/support`}
                   className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
                 >
                   Platform Guidelines
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
