"use client";

import { useTransition } from "react";
import { Lock, Phone, MapPin, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { payEscrowAdvance } from "@/actions/escrow";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  // If verified or already paid/held, show the value
  const isUnlocked = isVerified || status === "HELD" || status === "RELEASED";

  const handleUnlock = () => {
    if (!transactionId) return;

    startTransition(async () => {
      const result = await payEscrowAdvance(transactionId);
      if (result.success) {
        toast.success(t("unlockedSuccess"));
        return;
      }
      const msg = result.error?.message ?? "";
      if (msg.includes("ADDRESS_REQUIRED")) {
        toast.error(t("addressRequired"), { duration: 6000 });
        router.push("/profile");
      } else if (msg.includes("SELLER_ADDRESS_MISSING")) {
        toast.error(t("sellerAddressMissing"), { duration: 6000 });
      } else if (msg.includes("MFS_LINKAGE_REQUIRED")) {
        toast.error(t("linkMFSProfile"), { duration: 6000 });
        router.push("/profile");
      } else {
        toast.error(msg || t("unlockFailed"));
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
          <p className="text-[10px] uppercase font-bold text-emerald-700/70 dark:text-emerald-400/70 tracking-wider">
            {label}
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {value}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] text-emerald-600 font-medium">Verified access</span>
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
          <p className="text-[10px] uppercase font-bold tracking-wider">{label}</p>
          <p className="text-sm font-mono tracking-widest">XXXXXXXXXX</p>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-slate-100/10 dark:bg-black/20 backdrop-blur-[1px] transition-all group-hover:backdrop-blur-none">
        <div className="bg-white/95 dark:bg-slate-900/95 p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 scale-95 transition-transform group-hover:scale-100">
             <div className="flex items-center justify-center gap-2 mb-2">
               <div className="p-1 px-3 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold flex items-center gap-1 uppercase tracking-wide">
                 <Lock className="w-3 h-3" /> {t("securedInfo")}
               </div>
             </div>
             <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal mb-4">
               {t("gatedInfoReason")}
             </p>
             <Button
               variant="default"
               size="sm"
               onClick={handleUnlock}
               disabled={isPending}
               className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
             >
               {isPending ? t("processing") : t("unlockInfoBtn")}
             </Button>
        </div>
      </div>

      {status === "PENDING" && (
        <div className="mt-2 flex items-center gap-1.5 p-1.5 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700">
          <AlertCircle className="w-3.5 h-3.5" />
          {t("deliveryShield")}
        </div>
      )}
    </div>
  );
}
