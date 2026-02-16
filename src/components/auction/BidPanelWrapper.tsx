'use client';

import dynamic from 'next/dynamic';
// Import the props type from the original component if possible, 
// or just re-declare if it's not exported. 
// Since I can't easily see if it's exported without another read, I'll allow any props to be passed through.
// Actually, I saw the file content in Step 456, and BidPanelProps interface is NOT exported.
// So I will just use any for now to avoid TS errors, or redefine a subset.
// Better: Redefine the props interface here to be safe.

interface BidPanelProps {
  auctionId: string;
  currentPrice: number;
  minBidIncrement: number;
  endTime: Date | string;
  isExpired: boolean;
  sellerId: string;
  onBidPlaced?: () => void;
}

const BidPanel = dynamic(() => import('./BidPanel').then((mod) => mod.BidPanel), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
      <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
      <div className="h-20 bg-primary-50 rounded-xl mb-4"></div>
      <div className="h-12 bg-gray-100 rounded-xl mb-4"></div>
      <div className="h-10 bg-gray-200 rounded-lg"></div>
    </div>
  ),
});

export default function BidPanelWrapper(props: BidPanelProps) {
  return <BidPanel {...props} />;
}
