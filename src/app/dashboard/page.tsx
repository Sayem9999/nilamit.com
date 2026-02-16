import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getMyBids } from '@/actions/bid';
import { getMyAuctions } from '@/actions/auction';
import { formatBDT, formatRelativeTime } from '@/lib/format';
import { CountdownTimer } from '@/components/auction/CountdownTimer';
import Link from 'next/link';
import { Gavel, Package, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [myBids, myAuctions] = await Promise.all([getMyBids(), getMyAuctions()]);
  const activeBids = myBids.filter(b => (b.auction as any).status === 'ACTIVE');
  const wonBids = myBids.filter(b => (b.auction as any).status === 'SOLD' && (b.auction as any).winnerId === session!.user!.id);
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-heading font-bold text-2xl text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Bids', value: activeBids.length, icon: TrendingUp },
          { label: 'Won', value: wonBids.length, icon: Gavel },
          { label: 'My Auctions', value: myAuctions.length, icon: Package },
          { label: 'Total Bids', value: myBids.length, icon: Clock },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-medium text-gray-500">{s.label}</span>
            </div>
            <p className="font-heading font-bold text-2xl text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">My Bids</h2>
      {myBids.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl mb-10">
          <p className="text-gray-400 mb-3">No bids yet</p>
          <Link href="/auctions" className="text-sm text-primary-600 hover:underline">Browse auctions →</Link>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {myBids.slice(0, 10).map((bid) => (
            <Link key={bid.id} href={`/auctions/${bid.auction.id}`}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-4 hover:border-primary-200 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                  {bid.auction.images?.[0] ? <img src={bid.auction.images[0]} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center justify-center w-full h-full text-gray-300">📦</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600">{bid.auction.title}</p>
                  <span className="text-xs text-gray-400">Your bid: <span className="price text-gray-600">{formatBDT(bid.amount)}</span> · {formatRelativeTime(bid.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                   <p className="price text-sm text-primary-700">{formatBDT(bid.auction.currentPrice)}</p>
                   {(bid.auction as any).status === 'ACTIVE' && <CountdownTimer endTime={bid.auction.endTime} className="text-xs" />}
                 </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-lg text-gray-900">My Auctions</h2>
        <Link href="/auctions/create" className="text-sm text-primary-600 font-medium">+ Create New</Link>
      </div>
      {myAuctions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <p className="text-gray-400 mb-3">No auctions yet</p>
          <Link href="/auctions/create" className="text-sm text-primary-600 hover:underline">Create your first →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myAuctions.map((a) => (
            <Link key={a.id} href={`/auctions/${a.id}`}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-4 hover:border-primary-200 transition-colors group">
              <div className="min-w-0">
                 <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600">{a.title}</p>
                 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(a as any).status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
               </div>
              <span className="price text-primary-700">{formatBDT(a.currentPrice)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
