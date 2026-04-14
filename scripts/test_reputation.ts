import { recalculateUserReputation } from "../src/lib/reputation.js";
import { prisma } from "../src/lib/db.js";

async function simulate() {
  console.log("🚀 Testing Industry-Standard Reputation Algorithm...");
  
  // 1. Mock a "Veteran" seller (many sales, 4.5 rating)
  // 2. Mock a "New" seller (1 sale, 5.0 rating)
  
  const testUsers = [
    { name: "Veteran", sales: 50, purchases: 10, cancellations: 0, reviews: 40, avgRating: 4.5 },
    { name: "Newbie", sales: 1, purchases: 0, cancellations: 0, reviews: 1, avgRating: 5.0 },
    { name: "Sabo", sales: 10, purchases: 2, cancellations: 2, reviews: 5, avgRating: 3.0 },
  ];

  console.table(testUsers);
  console.log("\nCalculating weighted outputs (Bayesian m=5, C=4.5)...");

  for (const u of testUsers) {
    // Note: In real script, we would seed the DB and call recalculateUserReputation.
    // Here I'll replicate the math logic for verification.
    
    // Points
    const points = 100 + (u.sales * 10) + (u.purchases * 5) - (u.cancellations * 50);
    
    // Bayesian
    const v = u.reviews;
    const m = 5;
    const R = u.avgRating;
    const C = 4.5;
    const bayesianRating = (v / (v + m)) * R + (m / (v + m)) * C;
    
    // Final
    const final = Math.round(points * (bayesianRating / 5));
    
    console.log(`👤 ${u.name}: Points ${points} | Bayesian Rating ${bayesianRating.toFixed(2)} | Final Score: ${final}`);
  }
}

simulate().catch(console.error);
