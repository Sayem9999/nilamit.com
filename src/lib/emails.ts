/**
 * Email template helpers for Resend integration.
 * These generate HTML email bodies for transactional emails.
 */

export function outbidEmailHtml(title: string, currentPrice: number, auctionId: string, baseUrl: string) {
  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0;">You've Been Outbid!</h1>
      </div>
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #92400e; font-size: 14px;">Someone placed a higher bid on:</p>
        <p style="margin: 0; font-weight: 700; font-size: 16px; color: #111827;">${title}</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 800; color: #4f46e5;">৳${currentPrice.toLocaleString()}</p>
      </div>
      <a href="${baseUrl}/en/auctions/${auctionId}" style="display: block; background: #4f46e5; color: white; text-align: center; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Bid Again Now →
      </a>
      <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 24px;">
        You received this because you placed a bid on nilamit.com
      </p>
    </div>
  `;
}

export function auctionWonEmailHtml(title: string, winningPrice: number, auctionId: string, baseUrl: string) {
  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0;">🎉 You Won!</h1>
      </div>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #065f46; font-size: 14px;">Congratulations! You won the auction for:</p>
        <p style="margin: 0; font-weight: 700; font-size: 16px; color: #111827;">${title}</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 800; color: #059669;">৳${winningPrice.toLocaleString()}</p>
      </div>
      <a href="${baseUrl}/en/auctions/${auctionId}" style="display: block; background: #059669; color: white; text-align: center; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
        View Auction Details →
      </a>
      <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 24px;">
        Contact the seller to arrange payment and delivery.
      </p>
    </div>
  `;
}

export function auctionEndingSoonEmailHtml(title: string, currentPrice: number, auctionId: string, baseUrl: string) {
  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0;">⏰ Ending Soon!</h1>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #991b1b; font-size: 14px;">An auction on your watchlist is ending in less than 1 hour:</p>
        <p style="margin: 0; font-weight: 700; font-size: 16px; color: #111827;">${title}</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 800; color: #dc2626;">৳${currentPrice.toLocaleString()}</p>
      </div>
      <a href="${baseUrl}/en/auctions/${auctionId}" style="display: block; background: #dc2626; color: white; text-align: center; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Place Your Bid →
      </a>
      <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 24px;">
        You received this because this auction is on your watchlist.
      </p>
    </div>
  `;
}
