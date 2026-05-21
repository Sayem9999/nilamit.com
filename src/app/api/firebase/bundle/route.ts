import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    // Generate a Firestore Query Bundle with the default systemConfig document
    const bundle = db.bundle('system-config-bundle');
    const docSnap = await db.collection('systemConfig').doc('default').get();
    
    // Build the bundle buffer
    const buffer = bundle.add(docSnap).build();
    
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    log.error('[API Bundle] Failed to generate system config bundle', err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate bundle' },
      { status: 500 }
    );
  }
}
