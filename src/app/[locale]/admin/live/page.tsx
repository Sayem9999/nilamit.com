import AdminLiveFeed from "./AdminLiveFeed";

export const metadata = {
  title: "Live Activity Monitor | Nilamit Admin",
  description: "Real-time bidding activity across the platform.",
};

export default function AdminLivePage() {
  return (
    <div className="bg-gray-50/30 min-h-screen">
      <AdminLiveFeed />
    </div>
  );
}
