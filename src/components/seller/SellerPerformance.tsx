"use client";

import { useTranslations } from "next-intl";
import { BarChart3, TrendingUp, DollarSign, Award, Target, Star } from "lucide-react";
import { motion } from "framer-motion";

interface SellerPerformanceProps {
  stats: {
    totalSales: number;
    revenue: number;
    reputation: number;
    successRate: number;
  };
}

export function SellerPerformance({ stats }: SellerPerformanceProps) {
  const t = useTranslations("Dashboard");

  const metricCards = [
    {
      label: "Total Revenue",
      value: `৳${stats.revenue.toLocaleString()}`,
      icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
      bg: "bg-emerald-50",
      border: "border-emerald-100"
    },
    {
      label: "Success Rate",
      value: `${stats.successRate}%`,
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
      border: "border-blue-100"
    },
    {
      label: "Reputation Score",
      value: stats.reputation,
      icon: <Star className="w-5 h-5 text-amber-600" />,
      bg: "bg-amber-50",
      border: "border-amber-100"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-8 rounded-[2rem] border ${card.border} ${card.bg} shadow-sm group hover:shadow-md transition-all`}
          >
            <div className="flex items-center justify-between mb-4">
               <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                 {card.icon}
               </div>
               <Award className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
              {card.label}
            </div>
            <div className="text-3xl font-heading font-bold text-gray-900">
              {card.value}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <BarChart3 className="w-6 h-6 text-primary-600" />
            <h3 className="text-2xl font-bold text-gray-900">{t("sellerPerformance")} Insights</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <p className="text-gray-600 leading-relaxed font-medium">
                Your account is currently performing in the <span className="text-primary-600 font-bold underline underline-offset-4">Top 5%</span> of localized trusted traders. Maintain a response time under 30 minutes to unlock the <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold uppercase">Gold Seal</span>.
              </p>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold text-gray-500">
                  <span>Merchant Trust Threshold</span>
                  <span>{stats.reputation}/500</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.reputation / 500) * 100}%` }}
                    className="h-full bg-primary-500 rounded-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-[2.5rem] p-8 flex items-center justify-center border border-gray-100 shadow-inner">
               <div className="text-center">
                  <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm text-gray-400 font-medium">Sales Velocity Chart<br/>(Beta - v1.8.0)</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
