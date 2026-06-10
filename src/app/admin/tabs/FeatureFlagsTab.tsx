'use client';

import { useState } from 'react';
import {
  Sparkles, Mail, Wallet, ShieldCheck, Percent,
  Zap, PackagePlus, UserPlus, SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { updateSystemConfig } from '@/actions/admin-content';
import { SystemConfig } from '@/types';
import { ConfigToggle } from './_components/ConfigToggle';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-2 mb-1">
      {children}
    </h4>
  );
}

export function FeatureFlagsTab({ initialConfig }: { initialConfig: SystemConfig | null }) {
  // Config is supplied by the server (the admin page is force-dynamic, so it's
  // always fresh). No client-side fetch — a client-invoked getSystemConfig
  // (which wraps unstable_cache) could hang the tab on "Loading…" forever.
  const [config, setConfig] = useState<SystemConfig | null>(initialConfig);

  const handleToggle = async (field: keyof SystemConfig, value: boolean | number | null) => {
    if (!config) return;
    const previous = config[field];
    setConfig({ ...config, [field]: value } as SystemConfig);
    const loading = toast.loading('Updating…');
    try {
      const res = await updateSystemConfig({ [field]: value });
      if (res.success) toast.success('Operational mode updated', { id: loading });
      else {
        toast.error(res.error?.message || 'Failed to update', { id: loading });
        setConfig({ ...config, [field]: previous } as SystemConfig);
      }
    } catch {
      toast.error('Update failed', { id: loading });
      setConfig({ ...config, [field]: previous } as SystemConfig);
    }
  };

  const saveNumber = async (field: keyof SystemConfig, value: number, fallback: number) => {
    if (!config) return;
    if (isNaN(value) || value < 0 || value > 100) {
      setConfig({ ...config, [field]: fallback } as SystemConfig);
      await updateSystemConfig({ [field]: fallback });
      return;
    }
    await updateSystemConfig({ [field]: value });
    toast.success('Saved');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-primary-50 p-3 rounded-md">
            <SlidersHorizontal className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-lg text-gray-900">Bootstrap &amp; Operational Modes</h3>
            <p className="text-sm text-gray-500 mt-1">
              Platform-wide feature flags and requirement bypasses. Every switch is enforced
              server-side in its Server Action — toggling here changes real behavior for all users.
            </p>

            {!config ? (
              <div className="mt-8 text-center text-sm text-gray-400 py-6 border border-dashed border-gray-200 rounded-md">
                Failed to load system configuration.
              </div>
            ) : (
              <div className="mt-6 border-t border-gray-50 pt-4 space-y-5">

                {/* ── Onboarding & Verification ─────────────────────────── */}
                <div>
                  <SectionTitle>Onboarding &amp; Verification</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ConfigToggle
                      label="Require Posting Verification"
                      description="Enforce email verification on sellers before creating or relisting items."
                      icon={<Mail className="w-4 h-4 text-indigo-500" />}
                      checked={config.postingRequirementsEnabled ?? true}
                      onChange={(v) => handleToggle('postingRequirementsEnabled', v)}
                    />
                    <ConfigToggle
                      label="Require Bidding Verification"
                      description="Enforce email verification on bidders before placing any bid or Buy It Now."
                      icon={<Mail className="w-4 h-4 text-indigo-500" />}
                      checked={config.biddingRequirementsEnabled ?? true}
                      onChange={(v) => handleToggle('biddingRequirementsEnabled', v)}
                    />
                  </div>
                </div>

                {/* ── Payments & Advance Payment ────────────────────────── */}
                <div>
                  <SectionTitle>Payments &amp; Advance Payment</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ConfigToggle
                      label="Require MFS Linkage"
                      description="Require linked bKash/Nagad accounts for high-value bids (৳50,000+) or advance payments."
                      icon={<Wallet className="w-4 h-4 text-pink-500" />}
                      checked={config.mfsLinkageRequired ?? true}
                      onChange={(v) => handleToggle('mfsLinkageRequired', v)}
                    />
                    <ConfigToggle
                      label="Require Secured Advance Payment"
                      description="Route sales through secure treasury holds. When disabled, won auctions coordinate instantly with funds released."
                      icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
                      checked={config.escrowRequired ?? true}
                      onChange={(v) => handleToggle('escrowRequired', v)}
                    />

                    {/* COD-Advance hybrid (+ commitment %) */}
                    <div className="md:col-span-2 flex flex-col gap-3 p-4 bg-gray-50/50 rounded-md border border-gray-100/80">
                      <ConfigToggle
                        label="COD-Advance Payment Hybrid Model (Option A)"
                        description="Buyers pay a partial advance (delivery charge + commitment deposit) and the rest as Cash on Delivery."
                        icon={<ShieldCheck className="w-4 h-4 text-primary-600" />}
                        checked={config.hybridEscrowEnabled ?? false}
                        onChange={(v) => handleToggle('hybridEscrowEnabled', v)}
                      />
                      {(config.hybridEscrowEnabled ?? false) && (
                        <div className="flex items-center justify-between gap-4 pt-1 pl-1">
                          <span className="text-xs font-semibold text-gray-600">Commitment deposit %</span>
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={config.hybridCommitmentPercentage ?? 2}
                            onChange={(e) => setConfig({ ...config, hybridCommitmentPercentage: parseFloat(e.target.value) })}
                            onBlur={(e) => saveNumber('hybridCommitmentPercentage', parseFloat(e.target.value), 2)}
                            className="w-20 text-xs text-center border border-gray-200 rounded-md p-1.5 font-bold text-gray-900 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Commission (+ rate) */}
                    <div className="md:col-span-2 flex flex-col gap-3 p-4 bg-gray-50/50 rounded-md border border-gray-100/80">
                      <ConfigToggle
                        label="Platform Success Fees & Commissions"
                        description="Calculate success commissions on finished auctions. If disabled, all listings incur 0% fees."
                        icon={<Percent className="w-4 h-4 text-amber-500" />}
                        checked={config.commissionPercentageEnabled ?? true}
                        onChange={(v) => handleToggle('commissionPercentageEnabled', v)}
                      />
                      {(config.commissionPercentageEnabled ?? true) && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pl-1">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="radio" name="commissionMode"
                                checked={config.commissionPercentage === undefined || config.commissionPercentage === null}
                                onChange={() => handleToggle('commissionPercentage', null)}
                                className="text-primary-600 focus:ring-primary-500"
                              />
                              Dynamic tiers (default)
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                              <input
                                type="radio" name="commissionMode"
                                checked={config.commissionPercentage !== undefined && config.commissionPercentage !== null}
                                onChange={() => handleToggle('commissionPercentage', 1.5)}
                                className="text-primary-600 focus:ring-primary-500"
                              />
                              Flat custom rate
                            </label>
                          </div>
                          {config.commissionPercentage !== undefined && config.commissionPercentage !== null && (
                            <input
                              type="number" min="0" max="100" step="0.1"
                              value={config.commissionPercentage}
                              onChange={(e) => setConfig({ ...config, commissionPercentage: parseFloat(e.target.value) })}
                              onBlur={(e) => saveNumber('commissionPercentage', parseFloat(e.target.value), 1.5)}
                              className="w-20 text-xs text-center border border-gray-200 rounded-md p-1.5 font-bold text-gray-900 focus:ring-primary-500 focus:border-primary-500"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Marketplace Features (kill-switches) ──────────────── */}
                <div>
                  <SectionTitle>Marketplace Features</SectionTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ConfigToggle
                      label="Buy It Now"
                      description="Allow instant purchase at the listed BIN price. Off = bidding only."
                      icon={<Zap className="w-4 h-4 text-violet-500" />}
                      checked={config.buyItNowEnabled ?? true}
                      onChange={(v) => handleToggle('buyItNowEnabled', v)}
                    />
                    <ConfigToggle
                      label="New Listings"
                      description="Allow sellers to create and relist auctions. Off = listings paused platform-wide."
                      icon={<PackagePlus className="w-4 h-4 text-blue-500" />}
                      checked={config.newListingsEnabled ?? true}
                      onChange={(v) => handleToggle('newListingsEnabled', v)}
                    />
                    <ConfigToggle
                      label="User Registrations"
                      description="Allow new account sign-ups. Off = registration paused (existing users unaffected)."
                      icon={<UserPlus className="w-4 h-4 text-teal-500" />}
                      checked={config.registrationsEnabled ?? true}
                      onChange={(v) => handleToggle('registrationsEnabled', v)}
                    />
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
        <Sparkles className="w-3.5 h-3.5" />
        Changes apply immediately and are enforced server-side. Disabling a feature never affects in-flight transactions.
      </p>
    </div>
  );
}
