'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gavel, Shield, Clock, Users, ArrowRight, CheckCircle, Phone, TrendingUp, Zap, Sparkles, MapPin, Bell } from 'lucide-react';
import { CATEGORIES, AuctionWithSeller } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import AuctionCard from '@/components/auction/AuctionCard';

export function HomeContent({ trendingAuctions = [] }: { trendingAuctions?: AuctionWithSeller[] }) {
  const { t } = useLanguage();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-gray-100">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-50/50 rounded-full blur-[120px] -mr-96 -mt-96 opacity-60" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[100px] -ml-40 -mb-40 opacity-40" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-32 sm:pb-36">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Content */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="relative z-10"
            >
              <motion.div variants={itemVariants} className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-4 py-1.5 text-sm font-semibold mb-8 shadow-sm">
                <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
                {t.home.hero_badge}
              </motion.div>
              
              <motion.h1 variants={itemVariants} className="font-heading font-black text-5xl sm:text-6xl lg:text-7xl text-gray-900 leading-[1.1] tracking-tight">
                {t.home.hero_title_1}{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-primary-600 italic">{t.home.hero_title_2}</span>
                  <motion.span 
                    initial={{ width: 0 }}
                    whileInView={{ width: '100%' }}
                    transition={{ delay: 0.8, duration: 1.2 }}
                    className="absolute bottom-2 left-0 h-3 bg-primary-100 -z-0 rounded-full"
                  />
                </span>
              </motion.h1>
              
              <motion.p variants={itemVariants} className="mt-8 text-xl text-gray-500 max-w-xl leading-relaxed font-medium">
                {t.home.hero_desc}
              </motion.p>
              
              <motion.div variants={itemVariants} className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
                <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <MapPin className="w-4 h-4 text-primary-500" /> Area Filters
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Bell className="w-4 h-4 text-orange-500" /> Real-time Alerts
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <Zap className="w-4 h-4 text-yellow-500" /> Anti-Snipe
                </div>
              </motion.div>
              
              <motion.div variants={itemVariants} className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/auctions"
                  className="group relative inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-primary-200 hover:scale-105 active:scale-95 transition-all"
                >
                  {t.home.cta_browse} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/auctions/create"
                  className="inline-flex items-center justify-center gap-2 bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-700 font-bold px-8 py-4 rounded-2xl transition-all hover:border-gray-200 shadow-sm"
                >
                  {t.home.cta_sell}
                </Link>
              </motion.div>

              <motion.div variants={itemVariants} className="mt-12 flex items-center gap-6 text-gray-400">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 overflow-hidden ring-2 ring-primary-50">
                      <img src={`https://i.pravatar.cc/100?u=${i+10}`} alt="User" />
                    </div>
                  ))}
                </div>
                <div className="text-sm font-medium">
                  <span className="text-gray-900 font-bold">2.4k+</span> {t.home.how_subtitle}
                </div>
              </motion.div>
            </motion.div>

            {/* Right Visual Composition */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: 50 }}
              whileInView={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="hidden lg:block relative"
            >
              {/* Main Card */}
              <div className="relative z-20 bg-white rounded-[2rem] shadow-2xl shadow-primary-200/50 p-6 border border-gray-100 rotate-2">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 leading-none">Live Bidding</h4>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ending in 02:45:12</span>
                    </div>
                  </div>
                  <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse">
                    Hot Deal
                  </div>
                </div>
                
                <div className="aspect-[4/3] bg-gray-50 rounded-2xl mb-6 overflow-hidden relative group">
                  <img 
                    src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800" 
                    alt="Auction Item" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-gray-900 shadow-sm">
                    ৳ 45,000
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-medium">Current Bid</span>
                    <span className="font-bold text-primary-600 text-lg">৳ 45,800</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-4 border-b border-gray-100">
                    <span className="text-gray-400">Total Bidders</span>
                    <span className="font-bold text-gray-700">24 People</span>
                  </div>
                  <button className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all">
                    Place Your Bid
                  </button>
                </div>
              </div>

              {/* Floating Decorations */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-12 -left-12 z-30 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-xl -rotate-12"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-2">
                  <Gavel className="w-5 h-5 text-primary-600" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">New Bid</div>
                <div className="font-bold text-gray-900">+ ৳ 1,000</div>
              </motion.div>

              <motion.div 
                animate={{ x: [0, 20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute top-1/4 -right-16 z-30 bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-xl shadow-orange-100/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <Bell className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-xs font-bold text-gray-900 whitespace-nowrap">Instant Notify</div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-10 -right-8 z-30 bg-white/90 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-xl rotate-6"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</div>
                    <div className="text-xs font-bold text-gray-900">Verified Seller</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -left-20 bottom-12 z-30 bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl p-4 shadow-xl shadow-primary-100/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="text-xs font-bold text-gray-900">Area Filters Active</div>
                </div>
              </motion.div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary-100/30 rounded-full blur-[80px] -z-10" />
            </motion.div>

          </div>
        </div>
      </section>

      {/* Trending Section */}
      {trendingAuctions.length > 0 && (
        <section className="py-16 sm:py-24 bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mb-10"
            >
              <div>
                <h2 className="font-heading font-black text-3xl sm:text-4xl text-gray-900 tracking-tight">
                  <span className="text-primary-600">Trending</span> Auctions
                </h2>
                <p className="mt-2 text-gray-500 font-medium">Most popular items right now</p>
              </div>
              <Link 
                href="/auctions?sortBy=bids&sortOrder=desc"
                className="group flex items-center gap-2 text-primary-600 font-bold hover:text-primary-700 transition-colors"
              >
                View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
            >
              {trendingAuctions.slice(0, 4).map((auction) => (
                <motion.div key={auction.id} variants={itemVariants}>
                  <AuctionCard auction={auction} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">{t.home.categories_title}</h2>
            <p className="mt-2 text-gray-500">{t.home.categories_subtitle}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORIES.filter(c => c.slug !== 'other').map((cat) => (
              <Link
                key={cat.slug}
                href={`/auctions?category=${cat.slug}`}
                className="bg-gray-50 hover:bg-primary-50 border border-gray-100 hover:border-primary-200 rounded-2xl p-5 text-center transition-all group"
              >
                <div className="text-3xl mb-2">{cat.icon}</div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-primary-700">{cat.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">{t.home.how_title}</h2>
            <p className="mt-2 text-gray-500">{t.home.how_subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { icon: Users, title: t.home.step_1_title, desc: t.home.step_1_desc },
              { icon: Gavel, title: t.home.step_2_title, desc: t.home.step_2_desc },
              { icon: CheckCircle, title: t.home.step_3_title, desc: t.home.step_3_desc },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-7 h-7 text-primary-600" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 bg-primary-600 text-white rounded-full text-xs font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="font-heading font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">{t.home.trust_title}</h2>
            <p className="mt-2 text-gray-500">{t.home.trust_subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Phone, title: t.home.trust_1_title, desc: t.home.trust_1_desc },
              { icon: Clock, title: t.home.trust_2_title, desc: t.home.trust_2_desc },
              { icon: Shield, title: t.home.trust_3_title, desc: t.home.trust_3_desc },
              { icon: TrendingUp, title: t.home.trust_4_title, desc: t.home.trust_4_desc },
            ].map((feature, i) => (
              <div key={i} className="bg-primary-50/50 border border-primary-100 rounded-2xl p-6">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="font-heading font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-primary-600 to-primary-800">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-white mb-4">
            {t.home.cta_footer_title}
          </h2>
          <p className="text-primary-100 mb-8">
            {t.home.cta_footer_desc}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-all shadow-lg"
          >
            {t.home.cta_footer_btn} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
