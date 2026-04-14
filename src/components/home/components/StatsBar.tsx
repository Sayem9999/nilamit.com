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
    {
      icon: Gavel,
      value: totalAuctions.toLocaleString(),
      label: t("liveAuctions"),
      color: "text-primary-600",
      bg: "bg-primary-50",
    },
    {
      icon: Users,
      value: totalUsers.toLocaleString() + "+",
      label: t("activeMembers"),
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: TrendingUp,
      value: totalBids.toLocaleString(),
      label: t("bidsPlaced"),
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      icon: ShieldCheck,
      value: verifiedSellers.toLocaleString(),
      label: t("verifiedSellers"),
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <section className="border-y border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-center gap-4"
            >
              <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-heading font-black leading-none ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 font-semibold mt-0.5 uppercase tracking-wide">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
