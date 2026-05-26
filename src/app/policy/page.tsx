'use client';

import { ShieldCheck, Truck, AlertOctagon, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-white pt-28 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 rounded-full text-primary-600 text-xs font-bold mb-4">
            <ShieldCheck className="w-4 h-4" /> Nilamit Trust Guarantee
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-4">Marketplace Policy</h1>
          <p className="text-gray-500 font-medium">Building the most trusted peer-to-peer community in Bangladesh.</p>
        </header>

        <div className="space-y-12">
          {/* Section: Shipping & Coordination */}
          <section className="relative p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <Truck className="w-32 h-32 text-gray-900" />
             </div>
             <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <Truck className="w-6 h-6 text-indigo-600" />
                </div>
                Direct Coordination & Shipping
             </h2>
             <p className="text-gray-600 leading-relaxed mb-6">
                Nilamit is a self-coordinated peer-to-peer marketplace. Buyers and sellers communicate directly via coordination chat to arrange face-to-face meetups, direct handoffs, or self-directed courier deliveries (e.g. Pathao, Steadfast, Redx).
             </p>
             <ul className="space-y-4">
                <li className="flex gap-4">
                   <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                   </div>
                   <div>
                      <strong className="block text-gray-900 font-bold">Secure Direct Deals</strong>
                      <span className="text-sm text-gray-500">Nilamit secures the buyer&apos;s payment in our escrow system before shipping. Once the buyer receives and verifies the item directly from the seller or courier, funds are released.</span>
                   </div>
                </li>
             </ul>
          </section>

          {/* Section: Escrow */}
          <section className="p-8">
             <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                Escrow Protection
             </h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                   <h4 className="font-bold text-gray-900 mb-2">For Buyers</h4>
                   <p className="text-sm text-gray-500 leading-relaxed">
                      Your money is safe. We never release funds to the seller until you confirm the item is correct or the 72-hour inspection window passes.
                   </p>
                </div>
                <div>
                   <h4 className="font-bold text-gray-900 mb-2">For Sellers</h4>
                   <p className="text-sm text-gray-500 leading-relaxed">
                      Guarantee your sale. We only ask you to ship once the buyer&apos;s payment is fully secured in our escrow system.
                   </p>
                </div>
             </div>
          </section>

          {/* Section: Prohibited */}
          <section className="p-8 border-2 border-red-50 bg-red-50/10 rounded-[2.5rem]">
             <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertOctagon className="w-6 h-6 text-red-600" />
                </div>
                Zero Tolerance
             </h2>
             <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-red-100">
                   <h4 className="text-sm font-bold text-red-700 mb-1">Shill Bidding</h4>
                   <p className="text-xs text-gray-500">Using fake accounts to pump prices results in an immediate permanent ban for all involved IDs.</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-red-100">
                   <h4 className="text-sm font-bold text-red-700 mb-1">Off-Platform Deals</h4>
                   <p className="text-xs text-gray-500">Dealing outside Nilamit violates our safety protocols and removes your escrow protection.</p>
                </div>
             </div>
          </section>
        </div>

        <footer className="mt-20 pt-12 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-4">Ready to start trading?</p>
          <div className="flex justify-center gap-4">
             <Link href="/" className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all">
                Browse Auctions
             </Link>
             <Link href="/auctions/create" className="px-8 py-3 bg-white border border-gray-200 text-gray-900 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all">
                Start Selling
             </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
