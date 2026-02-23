export const dynamic = "force-dynamic";
import { getAdminStats } from "@/actions/admin";
import { getSystemConfig, getFeaturedAuctions } from "@/actions/admin-content";
import { AdminLayout } from "./AdminLayout";
import { SystemTab } from "./tabs/SystemTab";
import { ContentTab } from "./tabs/ContentTab";
import { ModerationTab } from "./tabs/ModerationTab";
import { Users, Package, TrendingUp, DollarSign } from "lucide-react";

function OverviewTab({
  stats,
}: {
  stats: {
    totalUsers: number;
    activeAuctions: number;
    totalBids: number;
    totalRevenue: number;
    recentUsers: {
      id: string;
      name: string | null;
      email: string | null;
      reputationScore: number;
      isVerifiedSeller: boolean;
    }[];
  };
}) {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Active Auctions"
          value={stats.activeAuctions}
          icon={<Package className="w-5 h-5 text-indigo-600" />}
          color="bg-indigo-50"
        />
        <StatCard
          label="Total Bids"
          value={stats.totalBids}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Revenue"
          value={`৳${stats.totalRevenue}`}
          icon={<DollarSign className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-4">
          Recent Users
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Reputation</th>
                <th className="px-4 py-3">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.recentUsers.map(
                (user: {
                  id: string;
                  name: string | null;
                  email: string | null;
                  reputationScore: number;
                  isVerifiedSeller: boolean;
                }) => (
                  <tr key={user.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600 text-center">
                      {user.reputationScore}
                    </td>
                    <td className="px-4 py-3">
                      {user.isVerifiedSeller ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Member
                        </span>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
        <p className="text-xl font-bold text-gray-900 font-heading">{value}</p>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const systemConfig = await getSystemConfig();
  const featuredAuctions = await getFeaturedAuctions();
  const adminStats = await getAdminStats();

  return (
    <AdminLayout
      overview={<OverviewTab stats={adminStats} />}
      moderation={<ModerationTab />}
      content={
        <ContentTab
          initialConfig={systemConfig}
          featuredAuctions={featuredAuctions}
        />
      }
      system={<SystemTab />}
    />
  );
}
