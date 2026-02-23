export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="font-heading font-bold text-3xl text-gray-900 mb-8">Privacy Policy</h1>
      
      <div className="prose prose-blue max-w-none space-y-6 text-gray-600">
        <section>
          <h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>
          <p>We collect your name, email address (via Google), and phone number (via verification). This is used solely for the operation of the auction marketplace.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">2. Data Usage</h2>
          <p>Your data is used to track bids, manage auctions, and send notifications. We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">3. Third Parties</h2>
          <p>We use Google for authentication, Resend for emails, and SMS gateways for phone verification. These partners handle your data according to their own privacy policies.</p>
        </section>
      </div>
    </div>
  );
}
