/**
 * Nilamit Gamification Engine
 * 
 * Rules for XP and Leveling:
 * - Level 1: 0 XP
 * - Level 2: 500 XP
 * - Level 3: 1500 XP
 * - Level n: Previous XP + (n * 1000)
 */

export const XP_REWARDS = {
  BID_PLACED: 10,
  AUCTION_WON: 100,
  SUCCESSFUL_SALE: 150,
  DAILY_LOGIN: 5,
  BONUS_STREAK: 50, // Per 5 consecutive wins
};

/**
 * Calculate level based on total XP
 */
export function calculateLevel(xp: number): number {
  let level = 1;
  let xpRequired = 500;
  
  while (xp >= xpRequired) {
    level++;
    xpRequired += level * 1000;
  }
  
  return level;
}

/**
 * Calculate progress to next level (0 to 100)
 */
export function calculateLevelProgress(xp: number): number {
  let level = 1;
  let currentLevelStart = 0;
  let nextLevelStart = 500;
  
  while (xp >= nextLevelStart) {
    level++;
    currentLevelStart = nextLevelStart;
    nextLevelStart += level * 1000;
  }
  
  const range = nextLevelStart - currentLevelStart;
  const progress = xp - currentLevelStart;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}
