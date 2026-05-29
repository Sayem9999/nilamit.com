"use client";

import type { ReactNode } from "react";

interface ConfigToggleProps {
  label: string;
  description: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** "danger" turns the ON state red (for kill-switches you'd be cautious enabling). */
  tone?: "primary" | "danger";
  /** Optional pill rendered next to the label (e.g. "Incomplete", "Beta"). */
  badge?: { label: string; tone: "amber" | "gray" | "green" };
}

const BADGE_TONES: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  gray: "bg-gray-100 text-gray-600 border-gray-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * Accessible switch (role=switch + aria-checked + keyboard/focus ring) used
 * across the admin Feature Flags tab. Single source of truth for toggle UX so
 * every operational switch looks and behaves identically.
 */
export function ConfigToggle({
  label,
  description,
  icon,
  checked,
  onChange,
  disabled = false,
  tone = "primary",
  badge,
}: ConfigToggleProps) {
  const onColor = tone === "danger" ? "bg-red-600" : "bg-primary-600";
  return (
    <div className="flex items-start justify-between p-4 bg-gray-50/50 hover:bg-gray-50 rounded-md border border-gray-100/80 transition-all duration-200">
      <div className="space-y-1 pr-4">
        <div className="flex items-center gap-2 flex-wrap">
          {icon}
          <span className="font-semibold text-gray-900 text-sm">{label}</span>
          {badge && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${BADGE_TONES[badge.tone]}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? onColor : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
