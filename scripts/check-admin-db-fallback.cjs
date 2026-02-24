const fs = require('fs');

const pagePath = 'src/app/[locale]/admin/page.tsx';
const utilPath = 'src/lib/db-errors.ts';

const page = fs.readFileSync(pagePath, 'utf8');
const util = fs.readFileSync(utilPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  util.includes("code === 'P1001'") || util.includes('code === "P1001"'),
  'db-errors utility must detect Prisma P1001',
);

assert(
  page.includes('getAdminStats().catch((error) => {') && page.includes('return FALLBACK_ADMIN_STATS;'),
  'Admin page must fallback when getAdminStats fails due to DB outage',
);

assert(
  page.includes('Data is temporarily unavailable.'),
  'Admin page must show degraded-state UX banner',
);

console.log('Admin DB fallback checks passed.');
