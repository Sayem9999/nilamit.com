"use client";

import { useTransition } from "react";
import { Lock, Phone, MapPin, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { payEscrowAdvance } from "@/actions/escrow";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface GatedContactInfoProps {
  status?: string;
  transactionId?: string;
  label: string;
  value: string;
  type: "phone" | "address";
  isVerified?: boolean;
}

export function GatedContactInfo({
  status,
  transactionId,
  label,
  value,
  type,
  isVerified = false,
}: GatedContactInfoProps) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Escrow");

  // If verified or already paid/held, show the value
  const isUnlocked = isVerified || status === "HELD" || status === "RELEASED";

  const handleUnlock = () => {
    if (!transactionId) return;
    
    startTransition(async () => {
      const result = await payEscrowAdvance(transactionId);
      if (result.success) {
        toast.success("অ্যাডভান্স সফল! তথ্য আনলক করা হয়েছে।");
      } else {
        toast.error(result.error || "আনলক করতে ব্যর্থ হয়েছে।");
      }
    });
  };

  if (isUnlocked) {
    return (
      <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900 shadow-sm animate-in fade-in duration-500">
        <div className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-sm">
          {type === "phone" ? (
            <Phone className="w-4 h-4 text-emerald-600" />
          ) : (
            <MapPin className="w-4 h-4 text-emerald-600" />
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-emerald-700/70 dark:text-emerald-400/70 tracking-wider bn">
            {label}
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {value}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] text-emerald-600 font-medium bn">যাচাইকৃত অ্যাক্সেস</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-start gap-3 blur-[3px] opacity-30 select-none grayscale pointer-events-none">
        <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full">
          {type === "phone" ? (
            <Phone className="w-4 h-4" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider bn">{label}</p>
          <p className="text-sm font-mono tracking-widest">XXXXXXXXXX</p>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-100/10 dark:bg-black/20 backdrop-blur-[1px] transition-all group-hover:backdrop-blur-none">
        <div className="bg-white/95 dark:bg-slate-900/95 p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 scale-95 transition-transform group-hover:scale-100">
           <div className="flex items-center justify-center gap-2 mb-2">
             <div className="p-1 px-3 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wide bn">
               <Lock className="w-3 h-3" /> সুরক্ষিত তথ্য
             </div>
           </div>
           <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal mb-4 bn">
             নিরাপত্তার স্বার্থে এই তথ্যটি গোপন রাখা হয়েছে। বিক্রেতাকে ডিল করার জন্য <span className="font-bold text-slate-900 dark:text-white underline decoration-amber-500 decoration-2 underline-offset-2">অ্যাডভান্স</span> পেমেন্ট সম্পন্ন করুন।
           </p>
           <Button 
             variant="default" 
             size="sm" 
             onClick={handleUnlock}
             disabled={isPending}
             className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 bn"
           >
             {isPending ? "প্রসেসিং..." : "তথ্য আনলক করুন"}
           </Button>
        </div>
      </div>

      {status === "PENDING" && (
        <div className="mt-2 flex items-center gap-1.5 p-1.5 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700 bn">
          <AlertCircle className="w-3.5 h-3.5" />
          {t("deliveryShield")}
        </div>
      )}
    </div>
  );
}
