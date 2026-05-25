'use client';

import { useState, useTransition, useMemo } from 'react';
import Papa from 'papaparse';
import { bulkCreateAuctions } from '@/actions/bulk-auction';
import { createAuctionSchema, formatZodError } from '@/lib/schemas';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Download,
  Trash2,
  Gavel,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface BulkAuctionItem {
  title: string;
  description: string;
  category: string;
  startingPrice: number;
  minBidIncrement: number;
  startTime: string;
  endTime: string;
  location: string;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
  images: string[];
}

interface QueueRow {
  item: BulkAuctionItem;
  /** Null when the row passes client-side schema validation. */
  error: string | null;
}

export default function BulkUploadPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<{
    success: number;
    failures: number;
    errors: { index: number; error: string; details?: unknown }[];
  } | null>(null);

  const validRows = useMemo(() => rows.filter((r) => r.error === null), [rows]);
  const invalidCount = rows.length - validRows.length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResults) => {
        const validated: QueueRow[] = (parseResults.data as Record<string, string>[]).map(
          (row) => {
            const item: BulkAuctionItem = {
              title: row.title,
              description: row.description,
              category: row.category?.toLowerCase() || 'electronics',
              startingPrice: Number(row.startingPrice || 100),
              minBidIncrement: Number(row.minBidIncrement || 10),
              startTime: row.startTime,
              endTime: row.endTime,
              location: row.location?.toLowerCase() || 'mirpur',
              condition: (row.condition?.toUpperCase() || 'USED') as
                | 'NEW'
                | 'USED'
                | 'REFURBISHED',
              images: row.images ? row.images.split('|').map((u) => u.trim()).filter(Boolean) : [],
            };

            // Mirror the server-side schema so users see errors before sync.
            const parsed = createAuctionSchema.safeParse(item);
            return {
              item,
              error: parsed.success ? null : formatZodError(parsed.error),
            };
          },
        );

        setRows(validated);
        const validCount = validated.filter((r) => r.error === null).length;
        const invalidLocal = validated.length - validCount;
        if (invalidLocal === 0) {
          toast.success(`Parsed ${validated.length} items — all valid`);
        } else {
          toast(`Parsed ${validated.length} items — ${invalidLocal} need fixing`, {
            icon: '⚠️',
          });
        }
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  const handleProcess = () => {
    if (validRows.length === 0) {
      toast.error('No valid rows to sync. Fix errors in your CSV first.');
      return;
    }
    startTransition(async () => {
      const res = await bulkCreateAuctions(validRows.map((r) => r.item));
      if (res.success) {
        setResults({
          success: res.data!.successCount,
          failures: res.data!.failureCount,
          errors: res.data!.errors,
        });
        if (res.data!.failureCount === 0) {
          toast.success('All items listed successfully!');
        } else {
          toast(`Completed with ${res.data!.failureCount} failures.`, { icon: '⚠️' });
        }
      } else {
        toast.error(res.error?.message || 'Bulk upload failed');
      }
    });
  };

  const downloadTemplate = () => {
    const headers = [
      'title',
      'description',
      'category',
      'startingPrice',
      'minBidIncrement',
      'startTime',
      'endTime',
      'location',
      'condition',
      'images',
    ];
    const sample = [
      'Vintage Watch',
      'Classic 1970s watch',
      'collectibles',
      '5000',
      '100',
      '2026-06-01T10:00',
      '2026-06-05T10:00',
      'mirpur',
      'USED',
      'https://example.com/img1.jpg|https://example.com/img2.jpg',
    ];
    const csv = Papa.unparse([headers, sample]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nilamit_bulk_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Link
              href="/retailer/dashboard"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors focus-visible:outline-none"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Seller Hub
            </Link>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  Bulk Inventory Sync
                </h1>
                <p className="text-gray-400 text-sm font-medium mt-1">
                  Upload and synchronize multiple listings instantly via CSV. Built for Pro Retailers.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-black hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-white/5"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download CSV template
          </button>
        </header>

        {!results ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section
              aria-labelledby="upload-step-heading"
              className="lg:col-span-1"
            >
              <div className="bg-[#141417] border border-white/5 p-8 rounded-[2rem] shadow-xl">
                <div className="mb-6">
                  <h2
                    id="upload-step-heading"
                    className="text-lg font-bold text-white mb-2"
                  >
                    1. Upload CSV
                  </h2>
                  <p className="text-xs text-gray-400 leading-relaxed font-medium">
                    Select your custom inventory spreadsheet. Make sure all headings follow the official template format to enable flawless synchronization.
                  </p>
                </div>

                <label
                  htmlFor="bulk-csv-input"
                  className="group relative block w-full aspect-square cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 rounded-3xl"
                >
                  <input
                    id="bulk-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-white/5 rounded-3xl group-hover:border-indigo-500 transition-all flex flex-col items-center justify-center p-6 text-center bg-[#0a0a0b]/40">
                    <div
                      className="p-4 bg-white/5 rounded-2xl mb-4 group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all"
                      aria-hidden="true"
                    >
                      <Upload className="w-8 h-8 text-gray-500 group-hover:text-indigo-400" />
                    </div>
                    <span className="text-sm font-bold text-white mb-1">
                      Click to browse
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                      CSV files only
                    </span>
                  </div>
                </label>
              </div>
            </section>

            <section aria-labelledby="queue-heading" className="lg:col-span-2">
              <div className="bg-[#141417] border border-white/5 rounded-[2rem] shadow-xl overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                  <h2
                    id="queue-heading"
                    className="font-bold text-white flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-indigo-400" aria-hidden="true" />
                    Queue Preview ({rows.length} {rows.length === 1 ? 'row' : 'rows'}
                    {invalidCount > 0 && (
                      <span className="ml-1 text-red-400 text-xs font-bold">
                        · {invalidCount} invalid
                      </span>
                    )}
                    )
                  </h2>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRows([])}
                      className="text-xs font-bold text-red-400 hover:text-red-500 inline-flex items-center gap-1 focus-visible:outline-none"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" /> Clear Queue
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-auto max-h-[500px]">
                  {rows.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <caption className="sr-only">
                        Items queued for bulk upload, with per-row validation status
                      </caption>
                      <thead className="sticky top-0 bg-[#0a0a0b] text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/5">
                        <tr>
                          <th scope="col" className="px-4 py-4 w-10">#</th>
                          <th scope="col" className="px-6 py-4">Title</th>
                          <th scope="col" className="px-6 py-4">Category</th>
                          <th scope="col" className="px-6 py-4">Start Price</th>
                          <th scope="col" className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm font-medium">
                        {rows.map(({ item, error }, i) => (
                          <tr
                            key={i}
                            className={`transition-colors ${
                              error ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className="px-4 py-4 text-xs text-gray-500 font-mono">
                              {i + 1}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-white truncate max-w-[200px]">
                              {item.title || <span className="italic text-gray-500">(missing)</span>}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
                              {item.category}
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-indigo-400">
                              ৳{item.startingPrice}
                            </td>
                            <td className="px-6 py-4">
                              {error ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full"
                                  title={error}
                                >
                                  <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  <span className="truncate max-w-[150px]">{error}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                      <div
                        className="p-4 bg-[#0a0a0b] rounded-full mb-4 border border-white/5"
                        aria-hidden="true"
                      >
                        <FileSpreadsheet className="w-12 h-12 text-gray-700" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">
                        Your upload queue is currently empty.
                      </p>
                    </div>
                  )}
                </div>

                {rows.length > 0 && (
                  <div className="p-6 bg-white/[0.01] border-t border-white/5">
                    {invalidCount > 0 && (
                      <p
                        role="status"
                        className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 leading-relaxed font-medium"
                      >
                        <strong>{invalidCount}</strong>{' '}
                        {invalidCount === 1 ? 'row has' : 'rows have'} validation errors and
                        will be skipped. Fix them in your CSV and re-upload to include them.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleProcess}
                      disabled={isPending || validRows.length === 0}
                      className="w-full py-4 bg-white text-black hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed rounded-2xl font-bold text-sm transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <Loader2
                          className="w-5 h-5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      )}
                      {isPending
                        ? 'Synchronizing...'
                        : validRows.length === 0
                          ? 'No valid rows to sync'
                          : `Sync ${validRows.length} ${validRows.length === 1 ? 'item' : 'items'} to marketplace`}
                    </button>
                    <p className="text-[10px] text-gray-500 text-center mt-3 font-medium">
                      By proceeding, you agree to our Professional Retailer Policy. All listings will
                      be publicly active immediately.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <section
            aria-labelledby="sync-result-heading"
            className="max-w-2xl mx-auto"
          >
            <div className="bg-[#141417] border border-white/5 rounded-[2rem] shadow-2xl p-10 text-center">
              <div
                className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/5"
                aria-hidden="true"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2
                id="sync-result-heading"
                className="text-3xl font-black text-white mb-2"
              >
                Sync Complete
              </h2>
              <p className="text-gray-400 mb-8 font-medium">
                The spreadsheet has been synchronized with the active Nilamit ledger:
              </p>

              <dl className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl">
                  <dd className="text-3xl font-black text-emerald-400 mb-1">
                    {results.success}
                  </dd>
                  <dt className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
                    Successful
                  </dt>
                </div>
                <div
                  className={`p-6 border rounded-3xl ${
                    results.failures > 0
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-white/5 border-white/5'
                  }`}
                >
                  <dd
                    className={`text-3xl font-black ${
                      results.failures > 0 ? 'text-red-400' : 'text-gray-500'
                    }`}
                  >
                    {results.failures}
                  </dd>
                  <dt className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Failed
                  </dt>
                </div>
              </dl>

              {results.errors.length > 0 && (
                <div
                  role="region"
                  aria-labelledby="error-log-heading"
                  className="text-left mb-8 max-h-48 overflow-auto bg-red-500/5 rounded-2xl border border-red-500/20 p-4"
                >
                  <h3
                    id="error-log-heading"
                    className="text-[10px] font-black uppercase tracking-widest text-red-400/80 mb-2"
                  >
                    Error log
                  </h3>
                  <ul className="space-y-1.5 list-none p-0">
                    {results.errors.map((err, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-red-400 flex gap-2 font-medium"
                      >
                        <AlertCircle
                          className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Item #{err.index + 1}: {err.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Link
                  href="/retailer/dashboard"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
                >
                  Return to Seller Hub
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setResults(null);
                    setRows([]);
                  }}
                  className="w-full py-4 text-gray-400 hover:text-white font-bold text-sm transition-all"
                >
                  Upload another file
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
