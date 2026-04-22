"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getAdminUsers,
  grantVerifiedSeller,
  revokeVerifiedSeller,
  banUser,
  unbanUser,
} from "@/actions/admin-users";
import { Shield, ShieldOff, Users, CheckCircle, Search, Ban } from "lucide-react";
import Image from "next/image";

export function UsersTab() {
  interface AdminUser {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    isVerifiedSeller: boolean;
    isPhoneVerified: boolean;
    reputationScore: number;
    createdAt: Date;
    _count: { bids: number };
    isBanned: boolean;
  }

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const res = await getAdminUsers(page, 20, debouncedSearch);
      if (mounted && res.success) {
        setUsers((res.users as unknown as AdminUser[]) || []);
        setTotalPages(res.pages || 1);
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [page, debouncedSearch]);

  const handleToggleVerified = (userId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const action = currentStatus ? revokeVerifiedSeller : grantVerifiedSeller;
      const result = await action(userId);
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, isVerifiedSeller: !currentStatus } : u,
          ),
        );
      }
    });
  };

  const handleToggleBan = (userId: string, isBanned: boolean) => {
    if (!confirm(`Are you sure you want to ${isBanned ? 'unban' : 'ban'} this user?`)) return;
    startTransition(async () => {
      const action = isBanned ? unbanUser : banUser;
      const result = await action(userId);
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, isBanned: !isBanned } : u,
          ),
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-gray-900">
            User Management
          </h2>
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search users..."
            className="bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  User
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Phone
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Rep
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Activity
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Verified Seller
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                        {user.image ? (
                          <Image
                            src={user.image}
                            alt=""
                            width={32}
                            height={32}
                            className="object-cover"
                          />
                        ) : (
                          <Users className="w-4 h-4 text-primary-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {user.name || "Unnamed"}
                          </p>
                          {user.isBanned && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">
                              Banned
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.isPhoneVerified ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">
                        Not verified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {user.reputationScore}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {user._count.bids} bids
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        handleToggleVerified(user.id, user.isVerifiedSeller)
                      }
                      disabled={isPending}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        user.isVerifiedSeller
                           ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                           : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {user.isVerifiedSeller ? (
                        <>
                          <Shield className="w-3.5 h-3.5" /> Verified
                        </>
                      ) : (
                        <>
                          <ShieldOff className="w-3.5 h-3.5" /> Grant
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleBan(user.id, user.isBanned)}
                      disabled={isPending}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        user.isBanned
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-red-50 text-red-700 hover:bg-red-100"
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {user.isBanned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
