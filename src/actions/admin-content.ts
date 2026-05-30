'use server';

import { db, snapDocs, docData } from '@/lib/db';
import { Auction, SystemConfig } from '@/types';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminService } from '@/services/admin/admin-service';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse, ServiceResponse } from '@/lib/errors';
import { systemConfigUpdateSchema, formatZodError } from '@/lib/schemas';

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  id: 'default',
  heroTitle: '',
  heroSubtitle: '',
  heroImage: null,
  announcement: null,
  showAnnouncement: false,
  treasuryBkash: null,
  treasuryNagad: null,
  mfsLinkageRequired: true,
  escrowRequired: true,
  commissionPercentageEnabled: true,
  commissionPercentage: null,
  postingRequirementsEnabled: true,
  biddingRequirementsEnabled: true,
  hybridEscrowEnabled: false,
  hybridCommitmentPercentage: 2,
  // Marketplace feature kill-switches.
  buyItNowEnabled: true,
  newListingsEnabled: true,
  registrationsEnabled: true,
  updatedAt: new Date(),
} as SystemConfig;

const getCachedSystemConfig = unstable_cache(
  async () => {
    const snap = await db.collection('systemConfig').doc('default').get();
    const data = docData<SystemConfig>(snap);
    return data ?? DEFAULT_SYSTEM_CONFIG;
  },
  ['system-config-global'],
  { revalidate: 3600, tags: ['config'] }
);

export async function getSystemConfig(): Promise<ServiceResponse<SystemConfig>> {
  try {
    const config = await getCachedSystemConfig();
    return successResponse(config);
  } catch (e) {
    log.error('[admin-content] getSystemConfig failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch system config');
  }
}

export async function updateSystemConfig(input: unknown): Promise<ServiceResponse<null>> {
  try {
    await requireAdmin();
    // Whitelist + validate before writing the shared config doc: unknown keys
    // are stripped (no mass-assignment) and treasury MFS numbers / percentages
    // are format-checked so a typo can't misroute payments or break math.
    const parsed = systemConfigUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return errorResponse(ErrorType.VALIDATION, formatZodError(parsed.error));
    }
    await db.collection('systemConfig').doc('default').set(
      { ...parsed.data, id: 'default', updatedAt: new Date() }, { merge: true }
    );
    revalidateTag('config', { expire: 0 });
    revalidatePath('/');
    revalidatePath('/admin');
    return successResponse(null);
  } catch (e) {
    log.error('[admin-content] updateSystemConfig failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Update failed');
  }
}

export async function toggleFeaturedAuction(auctionId: string, featured: boolean): Promise<ServiceResponse<null>> {
  try {
    await requireAdmin();
    await AdminService.toggleFeaturedAuction(auctionId, featured);
    revalidatePath('/');
    revalidatePath('/auctions');
    revalidatePath(`/auctions/${auctionId}`);
    return successResponse(null);
  } catch (e) {
    log.error('[admin-content] toggleFeaturedAuction failed', e);
    return errorResponse(ErrorType.INTERNAL, e instanceof Error ? e.message : 'Toggle failed');
  }
}

export async function getFeaturedAuctions(): Promise<ServiceResponse<Auction[]>> {
  try {
    await requireAdmin();
  } catch {
    return errorResponse(ErrorType.FORBIDDEN, 'Admin access required');
  }

  try {
    const snap = await db.collection('auctions')
      .where('isFeatured', '==', true)
      .where('status', '==', 'ACTIVE')
      .orderBy('endTime', 'asc')
      .get();
    return successResponse(snapDocs<Auction>(snap));
  } catch (e) {
    log.error('[admin-content] getFeaturedAuctions failed', e);
    return errorResponse(ErrorType.INTERNAL, 'Failed to fetch featured auctions');
  }
}
