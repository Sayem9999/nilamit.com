-- Add isVerifiedSeller to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerifiedSeller" BOOLEAN DEFAULT false;

-- Create OrderStatus enum type
DO $$ BEGIN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'RECEIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add fields to Auction
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "commissionEarned" DOUBLE PRECISION;
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "deliveryStatus" "OrderStatus" DEFAULT 'PENDING';
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
