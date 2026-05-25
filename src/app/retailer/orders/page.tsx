"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Gavel,
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  MessageSquare,
  Download,
  Loader2,
  Calendar,
  User,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatBDT } from "@/lib/format";

// Mock data representing retail orders for this seller
const INITIAL_ORDERS = [
  {
    id: "ord_918237",
    auctionTitle: "Sony PlayStation 5 Slim (Disc Edition)",
    buyer: "Shakib Al Hasan",
    email: "shakib@example.com",
    amount: 54000,
    status: "PENDING_SHIPMENT",
    createdAt: "2026-05-24T10:30:00Z",
    location: "Banani, Dhaka",
  },
  {
    id: "ord_728349",
    auctionTitle: "Mechanical Gaming Keyboard RGB",
    buyer: "Tamim Iqbal",
    email: "tamim@example.com",
    amount: 6500,
    status: "SHIPPED",
    createdAt: "2026-05-23T14:15:00Z",
    location: "Mirpur, Dhaka",
  },
  {
    id: "ord_612874",
    auctionTitle: "Bose QuietComfort Wireless Headphones",
    buyer: "Mushfiqur Rahim",
    email: "mushi@example.com",
    amount: 28000,
    status: "DELIVERED",
    createdAt: "2026-05-20T09:00:00Z",
    location: "Uttara, Dhaka",
  },
];

export default function RetailerOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState(INITIAL_ORDERS);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    let nextStatus = "PENDING_SHIPMENT";
    if (currentStatus === "PENDING_SHIPMENT") nextStatus = "SHIPPED";
    else if (currentStatus === "SHIPPED") nextStatus = "DELIVERED";
    else return;

    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o))
    );
    toast.success(`Order status updated to ${nextStatus.replace("_", " ")}!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_SHIPMENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-3 h-3" /> Pending Shipment
          </span>
        );
      case "SHIPPED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Truck className="w-3 h-3" /> Shipped
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Delivered
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/retailer/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors focus-visible:outline-none"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Seller Hub
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  Order Fulfillment
                </h1>
                <p className="text-gray-400 text-sm font-medium mt-1">
                  Track active sales, process MFS escrow shipments, and print customer invoices.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Orders List Container */}
        <div className="bg-[#141417] border border-white/5 rounded-[2rem] overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              Active Retail Ledger ({orders.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white/[0.01]">
                  <th className="px-6 py-4">Order ID & Date</th>
                  <th className="px-6 py-4">Item Details</th>
                  <th className="px-6 py-4">Buyer & Location</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-mono text-white font-bold">{order.id}</p>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[220px]">
                      <p className="text-white font-bold truncate" title={order.auctionTitle}>
                        {order.auctionTitle}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-bold flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-400" /> {order.buyer}
                      </p>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        {order.location}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-indigo-400">{formatBDT(order.amount)}</span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {order.status !== "DELIVERED" && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, order.status)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                            title="Progress Fulfillment State"
                          >
                            {order.status === "PENDING_SHIPMENT" ? "Ship Item" : "Mark Delivered"}
                          </button>
                        )}
                        <Link
                          href="/dashboard?tab=coordination"
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                          title="Contact Buyer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => toast.success("Invoice downloading...")}
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                          title="Print Packing Slip"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
