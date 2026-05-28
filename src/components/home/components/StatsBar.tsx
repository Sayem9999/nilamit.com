"use client";

import { motion } from "framer-motion";
import { Gavel, Users, TrendingUp, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

interface StatsBarProps {
  totalAuctions: number;
  totalUsers: number;
  totalBids: number;
  verifiedSellers: number;
}

export function StatsBar({ totalAuctions, totalUsers, totalBids, verifiedSellers }: StatsBarProps) {
  const t = useTranslations("Home");
  const stats = [
    { icon: Gavel,       value: totalAuctions.toLocaleString(),      label: t("liveAuctions"),    color: "text-primary-600", bg: "bg-primary-50",  border: "border-primary-100" },
    { icon: Users,       value: totalUsers.toLocaleString() + "+",   label: t("activeMembers"),   color: "text-blue-600",    bg: "bg-blue-50",     border: "border-blue-100" },
    { icon: TrendingUp,  value: totalBids.toLocaleString(),          label: t("bidsPlaced"),      color: "text-green-600",   bg: "bg-green-50",    border: "border-green-100" },
    { icon: ShieldCheck, value: verifiedSellers.toLocaleString(),    label: t("verifiedSellers"), color: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-100" },
  ];

  return (
    <section className="relative -mt-10 z-20" aria-label="Marketplace statistics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass shadow-premium rounded-[2.5rem] p-1 border border-white/50">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-100/60 bg-white/40 rounded-[2.25rem]">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex flex-col items-center justify-center py-8 px-4 text-center group"
              >
                <div className={`w-12 h-12 ${stat.bg} ${stat.border} border rounded-md flex items-center justify-center flex-shrink-0 mb-3 group-hover:scale-110 transition-transform duration-300 shadow-sm`} aria-hidden="true">
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <dd className={`text-2xl font-heading font-bold leading-none ${stat.color} tracking-tight`}>
                  {stat.value}
                </dd>
                <dt className="text-[10px] text-gray-500 font-bold mt-1.5 uppercase tracking-wide">
                  {stat.label}
                </dt>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
