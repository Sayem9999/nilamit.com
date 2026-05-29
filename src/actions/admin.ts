/**
 * admin.ts — Barrel file for administrative server actions.
 * 
 * Logic has been modularized into sub-files in the admin/ directory 
 * to maintain scalability as the platform grows.
 */

export { getAdminStats } from './admin/stats';
export { getAdminDisputes, resolveAdminDispute, getAdminCoordinationLog } from './admin/disputes';
export { getTreasuryAudit, getAdminActiveEscrows, getVerificationQueue, approveEscrowPayment, refundWithDeduction, getLedgerSummary, getRecentLedger } from './admin/treasury';
export { adminToggleVerification } from './admin/moderation';
export { grantVerifiedSeller, revokeVerifiedSeller, banUser, unbanUser, getAdminUsers } from './admin-users';
