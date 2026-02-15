import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAdminStats, getAdminUsers, getAdminAuctions } from '@/actions/admin';
import { formatBDT, formatRelativeTime } from '@/lib/format';
import { Users, Gavel, TrendingUp, Shield, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

type AdminUsersResult = Awaited<ReturnType<typeof getAdminUsers>>;
type AdminUser = AdminUsersResult['users'][number];
type AdminAuctionsResult = Awaited<ReturnType<typeof getAdminAuctions>>;
type AdminAuction = AdminAuctionsResult['auctions'][number];
type AdminStatsResult = Awaited<ReturnType<typeof getAdminStats>>;
type RecentUser = AdminStatsResult['recentUsers'][number];

export default async function AdminPage() {
  const session = await auth();
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

  if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
    redirect('/');
  }

  const stats = await getAdminStats();
  const users = await getAdminUsers(1, 15);
  const auctions = await getAdminAuctions(1, 15);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl text-gray-900">Admin Panel</h1>
          <p className="text-xs text-gray-500">Logged in as {session.user.email}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
          { label: 'Verified', value: stats.verifiedUsers, icon: CheckCircle, color: 'green' },
          { label: 'Auctions', value: stats.totalAuctions, icon: Gavel, color: 'purple' },
          { label: 'Active', value: stats.activeAuctions, icon: TrendingUp, color: 'orange' },
          { label: 'Total Bids', value: stats.totalBids, icon: TrendingUp, color: 'indigo' },
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

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Users Table */}
        <div>
          <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Users ({users.total})</h2>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Rep</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.users.map((u: AdminUser) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{u.name || 'No name'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {u.isPhoneVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" /> {u.phone?.slice(-4) || 'Yes'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <XCircle className="w-3 h-3" /> No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{u.reputationScore}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {u._count.auctionsAsSeller}a / {u._count.bids}b
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Auctions Table */}
        <div>
          <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Auctions ({auctions.total})</h2>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Auction</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Price</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Bids</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {auctions.auctions.map((a: AdminAuction) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/auctions/${a.id}`} className="font-medium text-gray-900 text-xs hover:text-primary-600">
                          {a.title.slice(0, 30)}{a.title.length > 30 ? '...' : ''}
                        </Link>
                        <p className="text-xs text-gray-400">{a.seller?.name || a.seller?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'active' ? 'bg-green-100 text-green-700'
                          : a.status === 'completed' ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{a.status}</span>
                      </td>
                      <td className="px-4 py-3 price text-xs text-primary-700">{formatBDT(a.currentPrice)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{a._count?.bids || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="mt-10">
        <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">Recent Signups</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stats.recentUsers.map((u: RecentUser) => (
            <div key={u.id} className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-900 truncate">{u.name || u.email}</p>
              <p className="text-xs text-gray-400">{formatRelativeTime(u.createdAt)}</p>
              <div className="flex items-center gap-2 mt-1">
                {u.isPhoneVerified && <span className="text-xs text-green-600">✓ Verified</span>}
                <span className="text-xs text-gray-400">Rep: {u.reputationScore}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
