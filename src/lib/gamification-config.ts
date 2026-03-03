export type BadgeType = "early_bird" | "sniper" | "whale" | "first_blood";

export interface BadgeConfig {
  id: BadgeType;
  name: string;
  description: string;
  icon: string; // Emoji for simple UI
}

export const BADGE_CONFIG: Record<BadgeType, BadgeConfig> = {
  first_blood: {
    id: "first_blood",
    name: "First Blood",
    description: "Placed the very first bid on an auction.",
    icon: "🩸",
  },
  early_bird: {
    id: "early_bird",
    name: "Early Bird",
    description: "Placed a bid within the first hour of an auction.",
    icon: "🌅",
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    description: "Placed a bid in the final 2 minutes of an auction.",
    icon: "🎯",
  },
  whale: {
    id: "whale",
    name: "Whale",
    description: "Placed a bid of 100,000 BDT or more.",
    icon: "🐋",
  },
};
