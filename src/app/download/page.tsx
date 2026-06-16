import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  Gavel,
  ShieldCheck,
  Bell,
  Search,
  Smartphone,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { InstallAppButton } from "@/components/install/InstallAppButton";

export const metadata: Metadata = {
  title: "Get the Nilamit Android App",
  description:
    "Download the Nilamit Android app — bid in real time, get instant outbid alerts, and buy safely with escrow. Free to install.",
  alternates: { canonical: "https://www.nilamit.com/download" },
};

const FEATURES = [
  { icon: Zap, title: "Real-time bidding", body: "Place bids and watch prices update live, with anti-snipe time extensions." },
  { icon: Bell, title: "Instant outbid alerts", body: "Get notified the moment someone outbids you, so you never lose by a second." },
  { icon: ShieldCheck, title: "Escrow-protected", body: "Pay safely through bKash/Nagad escrow — money releases only when you confirm." },
  { icon: Search, title: "Browse anywhere", body: "Search thousands of live auctions across every category, right from your phone." },
];

const STEPS = [
  { n: 1, title: "Tap download", body: "Grab the signed APK — it’s free and about 80 MB." },
  { n: 2, title: "Allow the install", body: "When prompted, allow installing apps from this source (one-time Android setting)." },
  { n: 3, title: "Open & sign in", body: "Launch Nilamit, sign in with Google, and start bidding." },
];

export default function DownloadPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-white border-b border-gray-100">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-primary-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-center relative">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-primary-600 text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
              <Smartphone className="w-3.5 h-3.5" /> Android app
            </span>
            <h1 className="mt-4 font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-gray-900 tracking-tight leading-[1.1]">
              Bid on the go with <span className="text-primary-600">Nilamit</span>
            </h1>
            <p className="mt-4 text-gray-600 text-base sm:text-lg max-w-md leading-relaxed">
              The full marketplace in your pocket — live bidding, instant alerts, and escrow-safe
              payments. Free to install.
            </p>

            <div className="mt-7">
              <InstallAppButton />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Free
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-500" /> Signed &amp; safe
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gavel className="w-4 h-4 text-primary-500" /> Same account as web
              </span>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight text-center">
          Everything you love about Nilamit
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="font-heading font-bold text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to install */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight text-center">
            Install in under a minute
          </h2>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="relative bg-white border border-gray-200 rounded-xl p-6">
                <div className="w-9 h-9 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="mt-4 font-heading font-bold text-gray-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <a
              href="/downloads/nilamit.apk"
              download
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary-600 text-white font-bold shadow-sm hover:bg-primary-700 active:scale-[0.98] transition-all"
            >
              <Download className="w-5 h-5" /> Download the APK
            </a>
            <p className="text-xs text-gray-500">
              Android 8+ • iOS coming soon. Prefer the web?{" "}
              <Link href="/auctions" className="text-primary-600 font-semibold hover:underline">
                Browse auctions <ArrowRight className="inline w-3 h-3" />
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Pure-CSS phone showing a mock auction screen — no external image needed. */
function PhoneMockup() {
  return (
    <div className="relative w-[260px] h-[540px] rounded-[2.5rem] bg-gray-900 p-3 shadow-2xl ring-1 ring-black/10">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-900 rounded-b-2xl z-10" />
      <div className="w-full h-full rounded-[2rem] bg-gray-50 overflow-hidden flex flex-col">
        {/* App header */}
        <div className="bg-white px-4 pt-7 pb-3 border-b border-gray-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold text-gray-900">
            nilam<span className="text-primary-600">it</span>
          </span>
        </div>
        {/* Promo */}
        <div className="m-3 rounded-xl bg-primary-600 p-3 text-white">
          <p className="text-[9px] font-bold tracking-wide text-amber-200">FREE TO LIST</p>
          <p className="text-sm font-extrabold leading-tight mt-0.5">Turn your stuff into cash</p>
        </div>
        {/* Card */}
        <div className="mx-3 rounded-xl bg-white border border-gray-200 overflow-hidden">
          <div className="aspect-[4/3] bg-gradient-to-br from-primary-100 to-gray-100 flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary-400" />
          </div>
          <div className="p-2.5">
            <div className="h-2 w-4/5 bg-gray-200 rounded" />
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-[8px] font-bold text-gray-400 uppercase">Current bid</p>
                <p className="text-sm font-extrabold text-gray-900">৳12,500</p>
              </div>
              <span className="text-[9px] font-bold text-red-500">⏱ 2h 14m</span>
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div className="mt-auto bg-white border-t border-gray-100 flex justify-around py-2 text-[9px] text-gray-400">
          <span className="text-primary-600 font-bold">🏠 Home</span>
          <span>🔎 Browse</span>
          <span>🔔 Activity</span>
          <span>👤 Account</span>
        </div>
      </div>
    </div>
  );
}
