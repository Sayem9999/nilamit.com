import { db } from '../src/lib/db';

async function checkStats() {
  try {
    const statsSnap = await db.collection('stats').doc('global').get();
    console.log('Global Stats:', statsSnap.exists ? statsSnap.data() : 'NOT FOUND');
    
    const configSnap = await db.collection('systemConfig').doc('default').get();
    console.log('System Config:', configSnap.exists ? configSnap.data() : 'NOT FOUND');
  } catch (err) {
    console.error('Error checking DB:', err);
  }
}

checkStats();
