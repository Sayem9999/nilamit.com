export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="font-heading font-bold text-3xl text-gray-900 mb-8">Terms of Service</h1>
      
      <div className="prose prose-blue max-w-none space-y-6 text-gray-600">
        <section>
          <h2 className="text-xl font-bold text-gray-900">1. Acceptance of Terms</h2>
          <p>By accessing nilamit.com, you agree to be bound by these terms. We provide a platform for auctions in Bangladesh.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">2. Bidding Rules</h2>
          <p>Every bid placed is a legally binding contract to purchase. You cannot cancel a bid once placed. Failure to complete a purchase as a winning bidder will result in account suspension.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">3. Selling Rules</h2>
          <p>Sellers must provide accurate descriptions and images. You are responsible for the items you list. nilamit.com is not responsible for the physical condition of items.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">4. Verification</h2>
          <p>Phone verification (+880) is mandatory for all active participants. This ensures a transparent and accountable marketplace for all Bangladeshis.</p>
        </section>
      </div>
    </div>
  );
}
