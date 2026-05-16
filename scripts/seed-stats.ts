import { db } from '../src/lib/db';

async function seed() {
  console.log('Seeding global stats and system config...');
  
  const statsRef = db.collection('stats').doc('global');
  const statsSnap = await statsRef.get();
  if (!statsSnap.exists) {
    await statsRef.set({
      totalUsers: 2450,
      totalBids: 15600,
      totalAuctions: 840,
      totalVerifiedSellers: 320,
      updatedAt: new Date()
    });
    console.log('Global stats seeded.');
  }

  const configRef = db.collection('systemConfig').doc('default');
  const configSnap = await configRef.get();
  if (!configSnap.exists) {
    await configRef.set({
      heroTitle: "The Future of Bidding in Bangladesh",
      heroSubtitle: "Experience transparency, security, and true market value.",
      heroImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
      updatedAt: new Date()
    });
    console.log('System config seeded.');
  }
}

seed().catch(console.error);
