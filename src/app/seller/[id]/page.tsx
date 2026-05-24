import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import AuctionCard from "@/components/auction/AuctionCard";
import { Star, ShieldCheck, MapPin, Calendar, Award, Shield, Package, CheckCircle } from 'lucide-react';
import Image from "next/image";
import { type User, type Auction, type Review, type AuctionWithSeller } from "@/types";
import { FollowSellerButton } from "@/components/social/FollowSellerButton";
import { isFollowingSeller, getFollowerCount } from "@/actions/seller-follow";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function SellerProfilePage({ params }: Props) {
  const { id } = await params;

  const sellerSnap = await db.collection('users').doc(id).get();
  if (!sellerSnap.exists) return notFound();
  const sellerData = sellerSnap.data() as User;
  
  const bidsSnap = await db.collection('bids').where('bidderId', '==', id).get();
  
  // Calculate success rate
  const totalTransactions = (sellerData.salesCount || 0) + (sellerData.defectCount || 0);
  const successRate = totalTransactions > 0 
    ? (((sellerData.salesCount || 0) / totalTransactions) * 100).toFixed(0) 
    : "100";

  const seller = {
    id: sellerSnap.id,
    name: sellerData.name,
    image: sellerData.image,
    isVerifiedSeller: sellerData.isVerifiedSeller,
    reputationScore: sellerData.rating,
    createdAt: sellerData.createdAt,
    winningStreak: sellerData.winningStreak,
    userLevel: sellerData.userLevel,
    ratingCount: sellerData.ratingCount,
    emailVerified: sellerData.emailVerified,
    isBanned: sellerData.isBanned,
    isTopRated: sellerData.isTopRated,
    isRetailer: !!sellerData.isRetailer,
    salesCount: sellerData.salesCount || 0,
    defectCount: sellerData.defectCount || 0,
    bio: sellerData.bio,
    _count: { bids: bidsSnap.size },
  };

  const [auctionsSnap, followingRes, followerCountRes] = await Promise.all([
    db.collection('auctions')
      .where('sellerId', '==', id)
      .where('status', 'in', ['ACTIVE', 'SOLD', 'AWAITING_PAYMENT', 'OFFER_PENDING'])
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
    isFollowingSeller(id),
    getFollowerCount(id),
  ]);

  const initialFollowing     = followingRes.success ? followingRes.data!.following : false;
  const initialFollowerCount = followerCountRes.success ? followerCountRes.data!.count : 0;

  const auctions = await Promise.all(auctionsSnap.docs.map(async d => {
    const a = d.data() as Auction;
    const abidsSnap = await db.collection('bids').where('auctionId', '==', d.id).get();
    const result: AuctionWithSeller = {
      ...a,
      id: d.id,
      createdAt: (a.createdAt as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.createdAt as unknown as string | Date),
      updatedAt: (a.updatedAt as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.updatedAt as unknown as string | Date),
      startTime: (a.startTime as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.startTime as unknown as string | Date),
      endTime: (a.endTime as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(a.endTime as unknown as string | Date),
      seller: {
        id: seller.id,
        name: seller.name,
        image: seller.image,
        isVerifiedSeller: sellerData.isVerifiedSeller,
        isRetailer: !!sellerData.isRetailer,
        isTopRated: sellerData.isTopRated,
        winningStreak: sellerData.winningStreak,
        userLevel: sellerData.userLevel,
        rating: seller.reputationScore,
        ratingCount: seller.ratingCount,
        emailVerified: sellerData.emailVerified,
        isBanned: sellerData.isBanned,
        salesCount: seller.salesCount,
        defectCount: seller.defectCount,
      },
      _count: { bids: abidsSnap.size },
    };
    return result;
  }));

  const reviewsSnap = await db.collection('reviews')
    .where('toId', '==', id)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const reviews = await Promise.all(reviewsSnap.docs.map(async d => {
    const r = d.data() as Review;
    const fromSnap = await db.collection('users').doc(r.fromId).get();
    return {
      ...r,
      id: d.id,
      from: { 
        name: (fromSnap.data() as User)?.name ?? null, 
        image: (fromSnap.data() as User)?.image ?? null 
      },
    };
  }));

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : (seller.reputationScore / 20).toFixed(1); // Fallback to internal score conversion

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Premium Storefront Header */}
      <div className="relative bg-white border-b border-gray-100 overflow-hidden pt-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/40 via-transparent to-accent-50/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100/20 rounded-full blur-3xl -mr-48 -mt-48" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-end -mb-8 pb-16">
            {/* Seller Avatar */}
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-white p-2 shadow-2xl shadow-primary-200/50 relative z-10">
                <div className="w-full h-full rounded-[2rem] overflow-hidden bg-gray-100 flex items-center justify-center relative">
                  {seller.image ? (
                    <Image src={seller.image} alt={seller.name || ""} fill sizes="(max-width: 768px) 128px, 160px" className="object-cover" referrerPolicy="no-referrer" unoptimized />
                  ) : (
                    <span className="text-4xl font-bold text-primary-300">{(seller.name || "?")[0]}</span>
                  )}
                </div>
              </div>
              {seller.isTopRated && (
                <div className="absolute -top-4 -right-4 z-20 animate-bounce-subtle">
                  <div className="bg-amber-400 text-white p-3 rounded-2xl shadow-lg border-2 border-white">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
              )}
            </div>

            {/* Seller Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl font-heading font-black text-gray-900 tracking-tight">
                  {seller.name}
                </h1>
                <div className="flex items-center justify-center md:justify-start">
                  <FollowSellerButton
                    sellerId={seller.id}
                    initialFollowing={initialFollowing}
                    initialFollowerCount={initialFollowerCount}
                  />
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  {seller.isVerifiedSeller && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100 flex items-center gap-1.5 shadow-sm">
                      <Shield className="w-3 h-3" /> VERIFIED SELLER
                    </span>
                  )}
                  {seller.isTopRated && (
                    <div className="flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full border border-yellow-200 text-[10px] font-black uppercase tracking-wider animate-in fade-in zoom-in duration-500">
                      <Star className="w-3 h-3 fill-yellow-400" />
                      Top Rated
                    </div>
                  )}
                  {seller.isRetailer && (
                    <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200 text-[10px] font-black uppercase tracking-wider animate-in fade-in zoom-in duration-500 delay-75">
                      <ShieldCheck className="w-3 h-3" />
                      Business Retailer
                    </div>
                  )}
                </div>
              </div>

              <p className="text-gray-500 text-sm max-w-2xl mb-6 font-medium">
                {seller.bio || `Welcome to ${seller.name}'s official storefront. Providing quality auctions and trusted service in Bangladesh since ${new Date(seller.createdAt).getFullYear()}.`}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4 text-primary-500" />
                  <span className="font-bold">Member Since {new Date(seller.createdAt).getFullYear()}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className="w-4 h-4 text-primary-500" />
                  <span className="font-bold">Bangladesh</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= Number(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="font-black text-gray-900 ml-1">{avgRating}</span>
                  <span className="text-gray-400 font-bold">({seller.ratingCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Dashboard Grid */}
      <div className="max-w-7xl mx-auto px-4 mt-16 mb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Items Sold</p>
            <p className="text-3xl font-black text-gray-900 font-heading">{seller.salesCount}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Success Rate</p>
            <p className="text-3xl font-black text-emerald-500 font-heading">{successRate}%</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reputation</p>
            <p className="text-3xl font-black text-primary-600 font-heading">{seller.reputationScore}</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Bids</p>
            <p className="text-3xl font-black text-indigo-500 font-heading">{seller._count.bids}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Listings Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900 font-heading tracking-tight flex items-center gap-3">
                <Package className="w-6 h-6 text-primary-600" />
                Active Auctions
              </h2>
              <span className="text-sm font-bold text-gray-400">{auctions.length} Items Found</span>
            </div>

            {auctions.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-6">
                {auctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-dashed border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No active listings</h3>
                <p className="text-gray-500 text-sm mt-1">This seller doesn&apos;t have any items for sale right now.</p>
              </div>
            )}
          </div>

          {/* Sidebar / Reviews & Info */}
          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
              <h2 className="text-xl font-black text-gray-900 font-heading mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                Recent Feedback
              </h2>
              
              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-auto">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium mb-2">&quot;{review.comment}&quot;</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden">
                          {review.from.image && <Image src={review.from.image} alt="" width={20} height={20} referrerPolicy="no-referrer" unoptimized />}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{review.from.name || "Anonymous"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No feedback received yet.</p>
              )}
            </div>

            <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
              
              <h3 className="text-lg font-black font-heading mb-4 relative z-10 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Nilamit Guarantee
              </h3>
              <p className="text-indigo-100 text-sm leading-relaxed mb-6 relative z-10">
                All transactions with this seller are protected by our secure escrow system. Funds are only released when you confirm delivery.
              </p>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Safe Checkout</p>
                  <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-tight">bKash • Nagad • Rocket</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
