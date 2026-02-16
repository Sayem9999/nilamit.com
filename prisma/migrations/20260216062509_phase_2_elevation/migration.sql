/*
  Warnings:

  - The values [draft,active,completed,cancelled] on the enum `AuctionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuctionStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED');
ALTER TABLE "public"."Auction" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Auction" ALTER COLUMN "status" TYPE "AuctionStatus_new" USING ("status"::text::"AuctionStatus_new");
ALTER TYPE "AuctionStatus" RENAME TO "AuctionStatus_old";
ALTER TYPE "AuctionStatus_new" RENAME TO "AuctionStatus";
DROP TYPE "public"."AuctionStatus_old";
ALTER TABLE "Auction" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "location" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVerifiedSeller" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Auction_location_idx" ON "Auction"("location");
