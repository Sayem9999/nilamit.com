import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import AuctionCard from "@/components/auction/AuctionCard";
import { Star, ShieldCheck, MapPin, Calendar, Award, Shield, Package, CheckCircle, Search, Edit3, Store, Trophy } from 'lucide-react';
import Image from "next/image";
import Link from "next/link";
import { type User, type Auction, type Review, type AuctionWithSeller } from "@/types";
import { FollowSellerButton } from "@/components/social/FollowSellerButton";
import { isFollowingSeller, getFollowerCount } from "@/actions/seller-follow";
import { getProxiedAvatarUrl } from "@/lib/avatar";
import { auth } from "@/lib/auth";

const safeGetYear = (dateInput: unknown) => {
  if (!dateInput) return new Date().getFullYear();
  let d: Date;
  if (dateInput && typeof (dateInput as { toDate?: () => Date }).toDate === 'function') {
    d = (dateInput as { toDate: () => Date }).toDate();
  } else {
    d = new Date(dateInput as string | number | Date);
  }
  return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
};

const safeFormatDate = (dateInput: unknown) => {
  if (!dateInput) return "N/A";
  let d: Date;
  if (dateInput && typeof (dateInput as { toDate?: () => Date }).toDate === 'function') {
    d = (dateInput as { toDate: () => Date }).toDate();
  } else {
    d = new Date(dateInput as string | number | Date);
  }
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
};

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ search?: string; view?: string }>;
}

export default async function SellerProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { search, view } = await searchParams;

  const session = await auth();
  const isOwner = session?.user?.id === id;

  const sellerSnap = await db.collection('users').doc(id).get();
  if (!sellerSnap.exists) return notFound();
  const sellerData = sellerSnap.data() as User;
  
  const bidsSnap = await db.collection('bids').where('bidderId', '==', id).get();

  const seller = {
    id: sellerSnap.id,
    name: sellerData.name,
    image: sellerData.image,
    isVerifiedSeller: sellerData.isVerifiedSeller,
    reputationScore: sellerData.rating,
    createdAt: sellerData.createdAt
      ? (typeof (sellerData.createdAt as unknown as { toDate?: () => Date }).toDate === 'function'
          ? (sellerData.createdAt as unknown as { toDate: () => Date }).toDate()
          : new Date(sellerData.createdAt as unknown as string | number | Date))
      : new Date(),
    winningStreak: sellerData.winningStreak || 0,
    userLevel: sellerData.userLevel || 1,
    xp: sellerData.xp || 0,
    ratingCount: sellerData.ratingCount,
    emailVerified: sellerData.emailVerified
      ? (typeof (sellerData.emailVerified as unknown as { toDate?: () => Date }).toDate === 'function'
          ? (sellerData.emailVerified as unknown as { toDate: () => Date }).toDate()
          : new Date(sellerData.emailVerified as unknown as string | number | Date))
      : null,
    isBanned: sellerData.isBanned,
    isTopRated: sellerData.isTopRated,
    isRetailer: !!sellerData.isRetailer,
    salesCount: sellerData.salesCount || 0,
    defectCount: sellerData.defectCount || 0,
    bio: sellerData.bio,
    banner: sellerData.banner,
    _count: { bids: bidsSnap.size },
  };

  const [auctionsSnap, followingRes, followerCountRes] = await Promise.all([
    db.collection('auctions')
      .where('sellerId', '==', id)
      .where('status', 'in', ['ACTIVE', 'SOLD', 'AWAITING_PAYMENT', 'OFFER_PENDING'])
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
    isFollowingSeller(id),
    getFollowerCount(id),
  ]);

  const initialFollowing     = followingRes.success ? followingRes.data!.following : false;
  const initialFollowerCount = followerCountRes.success ? followerCountRes.data!.count : 0;

  const rawAuctions = await Promise.all(auctionsSnap.docs.map(async d => {
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
        emailVerified: seller.emailVerified,
        isBanned: sellerData.isBanned,
        salesCount: seller.salesCount,
        defectCount: seller.defectCount,
      },
      _count: { bids: abidsSnap.size },
    };
    return result;
  }));

  // Separate auctions into active and completed lists
  const activeAuctions = rawAuctions.filter(a => a.status === 'ACTIVE');
  const completedAuctions = rawAuctions.filter(a => ['SOLD', 'AWAITING_PAYMENT', 'OFFER_PENDING'].includes(a.status));

  const filteredActive = search
    ? activeAuctions.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : activeAuctions;

  const filteredCompleted = search
    ? completedAuctions.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : completedAuctions;

  const currentView = view === "completed" ? "completed" : "active";
  const currentAuctions = currentView === "completed" ? filteredCompleted : filteredActive;

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

  const score = seller.reputationScore || 0;
  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : (score > 0 ? (score / 20).toFixed(1) : "0.0");

  const positiveReviews = reviews.filter(r => r.rating >= 4).length;
  const feedbackPercentage = reviews.length > 0
    ? ((positiveReviews / reviews.length) * 100).toFixed(0)
    : "100";

  // Theme configuration for beautiful visual feedback
  const theme = seller.isRetailer
    ? {
        primary: "indigo",
        bgLight: "bg-indigo-50",
        borderLight: "border-indigo-100",
        textPrimary: "text-indigo-600",
        bgPrimary: "bg-indigo-600",
        bgHover: "hover:bg-indigo-700",
        bgDark: "bg-indigo-900",
        badge: "BUSINESS RETAILER",
        badgeIcon: ShieldCheck,
      }
    : {
        primary: "emerald",
        bgLight: "bg-emerald-50",
        borderLight: "border-emerald-100",
        textPrimary: "text-emerald-600",
        bgPrimary: "bg-emerald-600",
        bgHover: "hover:bg-emerald-700",
        bgDark: "bg-emerald-950",
        badge: "VERIFIED TRADER",
        badgeIcon: Shield,
      };

  const getRankTitle = (lvl: number) => {
    if (lvl >= 21) return "Platinum Champion";
    if (lvl >= 11) return "Gold Elite";
    if (lvl >= 6) return "Silver Trader";
    return "Bronze Trader";
  };
  const rankTitle = getRankTitle(seller.userLevel);

  const xp = seller.xp;
  const xpInCurrentLevel = xp % 1000;
  const xpProgressPercentage = (xpInCurrentLevel / 1000) * 100;

  const sales = seller.salesCount || 0;
  const defects = seller.defectCount || 0;
  const fulfillmentRate = sales > 0 
    ? Math.max(0, 100 - Math.round((defects / sales) * 100)) 
    : 100;

  const tabActiveStyles = seller.isRetailer
    ? "border-indigo-600 text-gray-900"
    : "border-emerald-600 text-gray-900";

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Storefront cover banner billboard */}
      <div className="relative h-48 md:h-72 bg-gray-100 overflow-hidden w-full border-b border-gray-200 shadow-inner">
        {seller.banner ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={seller.banner}
            alt={`${seller.name || 'Store'} Banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${seller.isRetailer ? 'from-indigo-600 via-indigo-500 to-primary-800' : 'from-emerald-600 via-emerald-500 to-indigo-800'}`} />
            <div className="absolute inset-0 opacity-10" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm52-70c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM9 32c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm53 17c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM8 46c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm91-10c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zM40 52c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm7 0c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm14-27c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm11 5c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-1 30c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-13 14c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-2 10c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-10-2c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-15-2c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-8-31c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm0-1c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z' fill='%23ffffff' fill-opacity='0.08' fill-rule='evenodd'/%3E%3C/svg%3E")` }} 
              />
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[100px] -mr-48 -mt-48" />
            <div className={`absolute bottom-0 left-0 w-80 h-80 ${seller.isRetailer ? 'bg-indigo-500/20' : 'bg-emerald-500/20'} rounded-full blur-[80px] -ml-32 -mb-32`} />
          </>
        )}
      </div>

      {/* Overlapping Profile Details Card Block */}
      <div className="relative bg-white border-b border-gray-100 pb-12 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 relative z-10 -mt-16 md:-mt-24">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-end pb-4">
            {/* Seller Avatar */}
            <div className="relative group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white p-2 shadow-2xl shadow-primary-200/40 relative z-10 ring-4 ring-white">
                <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center relative">
                  {seller.image ? (
                    <Image src={getProxiedAvatarUrl(seller.image) || ""} alt={seller.name || ""} fill sizes="(max-width: 768px) 128px, 160px" className="object-cover" referrerPolicy="no-referrer" unoptimized />
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
            <div className="flex-1 text-center md:text-left pt-6 md:pt-0">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl font-heading font-black text-gray-900 tracking-tight drop-shadow-sm">
                  {seller.name}
                </h1>
                <div className="flex items-center justify-center md:justify-start">
                  {isOwner ? (
                    <Link
                      href="/dashboard?tab=profile"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-900 flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Profile / Settings
                    </Link>
                  ) : (
                    <FollowSellerButton
                      sellerId={seller.id}
                      initialFollowing={initialFollowing}
                      initialFollowerCount={initialFollowerCount}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  {seller.isVerifiedSeller && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100 flex items-center gap-1.5 shadow-sm">
                      <Shield className="w-3 h-3" /> VERIFIED TRADER
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

              <p className="text-gray-600 text-sm max-w-3xl mb-6 font-medium leading-relaxed">
                {seller.bio || (seller.isRetailer 
                  ? `Welcome to ${seller.name}'s official storefront. Discover authentic product collections, reliable services, and secure escrow guarantees since ${safeGetYear(seller.createdAt)}.`
                  : `Welcome to ${seller.name}'s official trading page. Safe C2C auctions and trusted community member in Bangladesh since ${safeGetYear(seller.createdAt)}.`)}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className={`w-4 h-4 ${theme.textPrimary}`} />
                  <span className="font-bold">Member Since {safeGetYear(seller.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin className={`w-4 h-4 ${theme.textPrimary}`} />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Sales / Trades */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.textPrimary}`}>
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                {seller.isRetailer ? "Items Sold" : "Trades Done"}
              </p>
              <p className="text-2xl font-black text-gray-900 font-heading leading-none">
                {seller.salesCount}
              </p>
            </div>
          </div>

          {/* Card 2: Positive Feedback */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.textPrimary}`}>
              <Star className="w-6 h-6 fill-current" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Positive Rating</p>
              <p className="text-2xl font-black text-emerald-500 font-heading leading-none">
                {feedbackPercentage}%
              </p>
            </div>
          </div>

          {/* Card 3: Reputation Score */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-xl ${theme.bgLight} ${theme.textPrimary}`}>
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Reputation Score</p>
              <p className={`text-2xl font-black font-heading leading-none ${theme.textPrimary}`}>
                {seller.reputationScore}
              </p>
            </div>
          </div>

          {/* Card 4: Dynamic Gamified Widget */}
          {seller.isRetailer ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Fulfillment</p>
                <p className="text-2xl font-black text-indigo-600 font-heading leading-none">
                  {fulfillmentRate}%
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="p-4 rounded-xl bg-orange-50 text-orange-600">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                  {seller.winningStreak > 0 ? "Winning Streak" : "Total Bids"}
                </p>
                <p className="text-2xl font-black text-orange-600 font-heading leading-none">
                  {seller.winningStreak > 0 ? `${seller.winningStreak} wins🔥` : seller._count.bids}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Listings Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Isomorphic View Tabs */}
                <div className="flex border-b border-gray-200 w-full sm:w-auto">
                  <Link
                    href={`/profile/${id}?view=active${search ? `&search=${search}` : ""}`}
                    className={`pb-4 px-6 text-sm font-black tracking-tight border-b-2 transition-all flex items-center gap-2 ${
                      currentView === "active"
                        ? `${tabActiveStyles} font-black`
                        : "border-transparent text-gray-400 hover:text-gray-600 font-bold"
                    }`}
                  >
                    Active Auctions
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      currentView === "active" 
                        ? (seller.isRetailer ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700") 
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {activeAuctions.length}
                    </span>
                  </Link>
                  <Link
                    href={`/profile/${id}?view=completed${search ? `&search=${search}` : ""}`}
                    className={`pb-4 px-6 text-sm font-black tracking-tight border-b-2 transition-all flex items-center gap-2 ${
                      currentView === "completed"
                        ? `${tabActiveStyles} font-black`
                        : "border-transparent text-gray-400 hover:text-gray-600 font-bold"
                    }`}
                  >
                    Completed Sales
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      currentView === "completed" 
                        ? (seller.isRetailer ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700") 
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {completedAuctions.length}
                    </span>
                  </Link>
                </div>
                
                <span className="text-xs font-bold text-gray-400 shrink-0 self-end mb-2">
                  {currentAuctions.length} {currentAuctions.length === 1 ? 'Item' : 'Items'} Found
                </span>
              </div>

              {/* Storefront Listings Search Form */}
              <form className="relative w-full sm:max-w-md" action="" method="GET">
                <input type="hidden" name="view" value={currentView} />
                <div className="relative">
                  <input
                    type="search"
                    name="search"
                    placeholder={currentView === "active" ? "Search active listings..." : "Search past sales..."}
                    defaultValue={search || ""}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-bold text-gray-700 shadow-sm transition-all"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </form>
            </div>

            {currentAuctions.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                {currentAuctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            ) : (
              currentView === "active" ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center shadow-sm">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No active listings</h3>
                  <p className="text-gray-500 text-sm mt-1">This seller doesn&apos;t have any active auctions right now.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center shadow-sm">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No completed sales</h3>
                  <p className="text-gray-500 text-sm mt-1">This seller doesn&apos;t have any completed sales record yet.</p>
                </div>
              )
            )}
          </div>

          {/* Sidebar / Reviews & Trust Profiles */}
          <div className="space-y-8">
            {/* Gamification / Policies Side Panel */}
            {seller.isRetailer ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
                <h2 className="text-xl font-black text-gray-900 font-heading flex items-center gap-2">
                  <Store className="w-5 h-5 text-indigo-600" />
                  Store Policies
                </h2>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">100% Genuine Products</h4>
                      <p className="text-[11px] text-gray-500 font-medium">All item descriptions are fully guaranteed or your money back.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">Fast Dhaka Delivery</h4>
                      <p className="text-[11px] text-gray-500 font-medium">Orders are processed within 24 hours of payment confirmation.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-tight">Escrow Protected</h4>
                      <p className="text-[11px] text-gray-500 font-medium">Payment is securely held by Nilamit until you confirm parcel delivery.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Gamified C2C Trader Stats Widget */
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
                <h2 className="text-xl font-black text-gray-900 font-heading flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                  Trader Status
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rank Title</span>
                    <span className="text-xs font-black text-gray-900 uppercase tracking-widest">{rankTitle}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">User Level</span>
                    <span className="text-xs font-black text-emerald-600 font-heading">Lv. {seller.userLevel}</span>
                  </div>
                  
                  {/* XP Progress Bar */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500">
                      <span>XP PROGRESS</span>
                      <span>{xpInCurrentLevel} / 1000 XP</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${xpProgressPercentage}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback Profile Feed */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-xl font-black text-gray-900 font-heading mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                Feedback Profile Feed
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
                          {safeFormatDate(review.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium mb-2">&quot;{review.comment}&quot;</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden">
                          {review.from.image && <Image src={getProxiedAvatarUrl(review.from.image) || ""} alt="" width={20} height={20} referrerPolicy="no-referrer" unoptimized />}
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

            <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
              
              <h3 className="text-lg font-black font-heading mb-4 relative z-10 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Nilamit Guarantee
              </h3>
              <p className="text-indigo-100 text-sm leading-relaxed mb-6 relative z-10">
                All transactions are protected by our secure escrow system. Funds are only released when you confirm delivery.
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
