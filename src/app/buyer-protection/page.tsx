/**
 * /buyer-protection — the escrow guarantee, marketed.
 *
 * The platform has always HAD escrow protection; this page makes it a selling
 * point the way eBay markets its Money Back Guarantee. Linked from the footer
 * and shareable on social media (OG metadata below).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Lock, PackageCheck, RotateCcw, Scale, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Nilamit Buyer Protection — every purchase escrow-protected',
  description:
    'Your money stays in escrow until you confirm delivery. If the item never arrives or is not as described, you get your money back. That is the Nilamit guarantee.',
  openGraph: {
    title: 'Nilamit Buyer Protection',
    description: 'Money held in escrow until you confirm delivery — or you get it back.',
    images: [{ url: '/api/og?title=Buyer%20Protection%20Guarantee', width: 1200, height: 630 }],
  },
};

const STEPS = [
  {
    icon: Lock,
    title: 'You pay — we hold it',
    body: 'When you win, your payment goes into Nilamit escrow, not to the seller. The seller sees the payment is secured and ships your item.',
  },
  {
    icon: PackageCheck,
    title: 'You receive and inspect',
    body: 'Take your time to check the item against the listing. The seller is not paid until you tap "Item Received".',
  },
  {
    icon: RotateCcw,
    title: 'Not right? Get your money back',
    body: 'Item never arrived, or clearly not as described? Open a dispute from your dashboard and our team refunds you from escrow.',
  },
  {
    icon: Scale,
    title: 'Fair disputes, human review',
    body: 'Every dispute is reviewed by a real moderator with the full conversation and evidence from both sides — not an algorithm.',
  },
];

export default function BuyerProtectionPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 md:py-20 text-center">
          <ShieldCheck className="w-14 h-14 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Buyer Protection on every purchase
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-emerald-50 text-sm md:text-lg leading-relaxed">
            Your money is held in escrow until you confirm delivery. If the item never
            arrives or isn&apos;t as described — you get it back. No exceptions.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-center text-xl md:text-2xl font-bold text-gray-900 mb-10">
          How the guarantee works
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>

        {/* What's covered */}
        <div className="mt-12 rounded-lg border border-emerald-100 bg-emerald-50/60 p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">What&apos;s covered</h2>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Item never arrives
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Item is materially different from the listing
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Item arrives broken or non-functional
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Counterfeit where authenticity was claimed
            </li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            Buyer&apos;s remorse and accurately-described used-item wear are not covered.
            Always review photos and ask the seller questions before bidding.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            Shop with confidence <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-gray-400">
            Questions? <Link href="/faq" className="underline hover:text-gray-600">Read the FAQ</Link> or{' '}
            <Link href="/contact" className="underline hover:text-gray-600">contact us</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
