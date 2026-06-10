'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createAuctionChat } from '@/actions/chat';
import { toast } from 'react-hot-toast';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  auctionId: string;
}

export function StartChatButton({ auctionId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const res = await createAuctionChat(auctionId);
      if (res.success) {
        toast.success('Coordination chat initialized!');
        router.refresh();
      } else {
        toast.error(res.error?.message || 'Failed to initialize chat.');
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-md shadow-blue-500/10 font-bold py-2.5 h-10 text-xs"
      onClick={handleTrigger}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <MessageSquare className="w-4 h-4" />
      )}
      Start Coordination Chat
    </Button>
  );
}
