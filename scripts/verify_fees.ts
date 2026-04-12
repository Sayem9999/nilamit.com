import { calculateSuccessFee } from "../src/lib/auction-logic.js";

const testCases = [
  { price: 5000, expected: 145 },   // Tier 1: 5000 * 0.025 + 20 = 125 + 20 = 145
  { price: 10000, expected: 270 },  // Tier 1: 10000 * 0.025 + 20 = 250 + 20 = 270
  { price: 10001, expected: 170 },  // Tier 2: 10001 * 0.015 + 20 ≈ 150 + 20 = 170
  { price: 50000, expected: 770 },  // Tier 2: 50000 * 0.015 + 20 = 750 + 20 = 770
  { price: 150000, expected: 2270 }, // Tier 2: 150000 * 0.015 + 20 = 2250 + 20 = 2270
  { price: 150001, expected: 1520 }, // Tier 3: 150001 * 0.01 + 20 ≈ 1500 + 20 = 1520
  { price: 1000000, expected: 10020 }, // Tier 3: 1000000 * 0.01 + 20 = 10000 + 20 = 10020
];

console.log("🚀 Verifying Nilamit Success Fee Tiers...");
let passed = 0;

testCases.forEach(({ price, expected }) => {
  const result = Math.round(calculateSuccessFee(price));
  if (result === expected) {
    console.log(`✅ Passed: ৳${price.toLocaleString()} -> ৳${result.toLocaleString()}`);
    passed++;
  } else {
    console.error(`❌ Failed: ৳${price.toLocaleString()} -> Expected ৳${expected.toLocaleString()}, got ৳${result.toLocaleString()}`);
  }
});

if (passed === testCases.length) {
  console.log("\n✨ All Success Fee Tiers Verified!");
} else {
  process.exit(1);
}
