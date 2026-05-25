export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getAdminStats } from "@/actions/admin";
import { getSystemConfig, getFeaturedAuctions } from "@/actions/admin-content";
import { AdminLayout } from "./AdminLayout";
import { SystemTab } from "./tabs/SystemTab";
import { ContentTab } from "./tabs/ContentTab";
import { ModerationTab } from "./tabs/ModerationTab";
import { UsersTab } from "./tabs/UsersTab";
import { MetricsTab } from "./tabs/MetricsTab";
import { DisputesTab } from "./tabs/DisputesTab";
import { TreasuryTab } from "./tabs/TreasuryTab";
import { Users, Package, TrendingUp, DollarSign } from "lucide-react";
import { SystemConfig } from "@/types";
import AdminLiveFeed from "./live/AdminLiveFeed";

async function OverviewTab({
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
  const t = await getTranslations("Admin.overview");
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <section aria-labelledby="admin-stats-heading">
        <h2 id="admin-stats-heading" className="sr-only">
          {t("statsHeading")}
        </h2>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 list-none p-0">
          <li>
            <StatCard
              label={t("totalUsers")}
              value={stats.totalUsers}
              icon={<Users className="w-5 h-5 text-blue-600" aria-hidden="true" />}
              color="bg-blue-50"
            />
          </li>
          <li>
            <StatCard
              label={t("activeAuctions")}
              value={stats.activeAuctions}
              icon={<Package className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
              color="bg-indigo-50"
            />
          </li>
          <li>
            <StatCard
              label={t("totalBids")}
              value={stats.totalBids}
              icon={<TrendingUp className="w-5 h-5 text-green-600" aria-hidden="true" />}
              color="bg-green-50"
            />
          </li>
          <li>
            <StatCard
              label={t("revenue")}
              value={`৳${stats.totalRevenue}`}
              icon={<DollarSign className="w-5 h-5 text-amber-600" aria-hidden="true" />}
              color="bg-amber-50"
            />
          </li>
        </ul>
      </section>

      {/* Recent Activity Section */}
      <section
        aria-labelledby="recent-users-heading"
        className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
      >
        <h2
          id="recent-users-heading"
          className="font-heading font-semibold text-lg text-gray-900 mb-4"
        >
          {t("recentUsersHeading")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th scope="col" className="px-4 py-3">{t("colName")}</th>
                <th scope="col" className="px-4 py-3">{t("colEmail")}</th>
                <th scope="col" className="px-4 py-3 text-center">{t("colReputation")}</th>
                <th scope="col" className="px-4 py-3">{t("colVerified")}</th>
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
                          {t("badgeVerified")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {t("badgeMember")}
                        </span>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
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
  // DB-deep admin gate — JWT alone is insufficient because revoked admins
  // retain a valid session token until expiry.
  const session = await requireAdmin().catch(() => null);
  if (!session) redirect("/login");

  const [systemConfigRes, featuredAuctionsRes, adminStatsRes] = await Promise.all([
    getSystemConfig(),
    getFeaturedAuctions(),
    getAdminStats(),
  ]);

  const systemConfig = systemConfigRes.success ? systemConfigRes.data : null;
  const featuredAuctions = featuredAuctionsRes.success ? featuredAuctionsRes.data : [];
  const adminStats = adminStatsRes.success ? adminStatsRes.data : {
    totalUsers: 0,
    verifiedUsers: 0,
    totalAuctions: 0,
    activeAuctions: 0,
    totalBids: 0,
    totalRevenue: 0,
    recentUsers: [],
  };

  return (
    <AdminLayout
      overview={<OverviewTab stats={adminStats as Parameters<typeof OverviewTab>[0]['stats']} />}
      moderation={<ModerationTab />}
      content={
        <ContentTab
          initialConfig={systemConfig as SystemConfig}
          featuredAuctions={featuredAuctions as Parameters<typeof ContentTab>[0]['featuredAuctions']}
        />
      }
      system={<SystemTab />}
      users={<UsersTab />}
      metrics={<MetricsTab />}
      treasury={<TreasuryTab />}
      disputes={<DisputesTab />}
      live={<AdminLiveFeed />}
    />
  );
}
