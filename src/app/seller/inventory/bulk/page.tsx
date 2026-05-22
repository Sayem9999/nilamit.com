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
    <main className="min-h-screen bg-gray-50 pt-28 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to dashboard
            </Link>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Bulk inventory upload
            </h1>
            <p className="text-gray-500 text-sm font-medium mt-1">
              Upload many listings at once with a CSV — built for high-volume retailers.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all motion-reduce:transition-none shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
              <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="mb-6">
                  <h2
                    id="upload-step-heading"
                    className="text-lg font-bold text-gray-900 mb-2"
                  >
                    1. Upload CSV
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Upload your inventory file. Make sure it follows our template
                    structure for flawless synchronization.
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
                  <div className="absolute inset-0 border-2 border-dashed border-gray-200 rounded-3xl group-hover:border-primary-500 transition-all motion-reduce:transition-none flex flex-col items-center justify-center p-6 text-center">
                    <div
                      className="p-4 bg-gray-50 rounded-2xl mb-4 group-hover:scale-110 group-hover:bg-primary-50 transition-all motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      aria-hidden="true"
                    >
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary-600" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 mb-1">
                      Click to browse
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                      CSV files only
                    </span>
                  </div>
                </label>
              </div>
            </section>

            <section aria-labelledby="queue-heading" className="lg:col-span-2">
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h2
                    id="queue-heading"
                    className="font-bold text-gray-900 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-indigo-500" aria-hidden="true" />
                    Queue preview ({rows.length} {rows.length === 1 ? 'row' : 'rows'}
                    {invalidCount > 0 && (
                      <span className="ml-1 text-red-600 text-xs font-bold">
                        · {invalidCount} invalid
                      </span>
                    )}
                    )
                  </h2>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRows([])}
                      className="text-xs font-bold text-red-500 hover:text-red-600 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" /> Clear
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-auto max-h-[500px]">
                  {rows.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <caption className="sr-only">
                        Items queued for bulk upload, with per-row validation status
                      </caption>
                      <thead className="sticky top-0 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                        <tr>
                          <th scope="col" className="px-4 py-4 w-10">#</th>
                          <th scope="col" className="px-6 py-4">Title</th>
                          <th scope="col" className="px-6 py-4">Category</th>
                          <th scope="col" className="px-6 py-4">Start price</th>
                          <th scope="col" className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {rows.map(({ item, error }, i) => (
                          <tr
                            key={i}
                            className={`transition-colors motion-reduce:transition-none ${
                              error ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-gray-50/50'
                            }`}
                          >
                            <td className="px-4 py-4 text-xs text-gray-400 font-mono">
                              {i + 1}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-gray-900 truncate max-w-[200px]">
                              {item.title || <span className="italic text-gray-400">(missing)</span>}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {item.category}
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-primary-600">
                              ৳{item.startingPrice}
                            </td>
                            <td className="px-6 py-4">
                              {error ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700"
                                  title={error}
                                >
                                  <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  <span className="truncate max-w-[180px]">{error}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
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
                        className="p-4 bg-gray-50 rounded-full mb-4"
                        aria-hidden="true"
                      >
                        <FileSpreadsheet className="w-12 h-12 text-gray-200" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">
                        Your upload queue is currently empty.
                      </p>
                    </div>
                  )}
                </div>

                {rows.length > 0 && (
                  <div className="p-6 bg-gray-50 border-t border-gray-100">
                    {invalidCount > 0 && (
                      <p
                        role="status"
                        className="mb-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 leading-relaxed"
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
                      className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm transition-all motion-reduce:transition-none shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    >
                      {isPending ? (
                        <Loader2
                          className="w-5 h-5 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      )}
                      {isPending
                        ? 'Syncing…'
                        : validRows.length === 0
                          ? 'No valid rows to sync'
                          : `Sync ${validRows.length} ${validRows.length === 1 ? 'item' : 'items'} to marketplace`}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center mt-3 font-medium">
                      By proceeding, you agree to our Retailer Policy. All listings will
                      be public immediately.
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
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-10 text-center">
              <div
                className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6"
                aria-hidden="true"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2
                id="sync-result-heading"
                className="text-3xl font-black text-gray-900 mb-2"
              >
                Sync complete
              </h2>
              <p className="text-gray-500 mb-8">
                Process finished with the following results:
              </p>

              <dl className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
                  <dd className="text-3xl font-black text-emerald-600 mb-1">
                    {results.success}
                  </dd>
                  <dt className="text-[10px] font-black uppercase tracking-widest text-emerald-800/70">
                    Successful
                  </dt>
                </div>
                <div
                  className={`p-6 border rounded-3xl ${
                    results.failures > 0
                      ? 'bg-red-50 border-red-100'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <dd
                    className={`text-3xl font-black ${
                      results.failures > 0 ? 'text-red-600' : 'text-gray-400'
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
                  className="text-left mb-8 max-h-48 overflow-auto bg-red-50/50 rounded-2xl border border-red-50 p-4"
                >
                  <h3
                    id="error-log-heading"
                    className="text-[10px] font-black uppercase tracking-widest text-red-800/70 mb-2"
                  >
                    Error log
                  </h3>
                  <ul className="space-y-1.5 list-none p-0">
                    {results.errors.map((err, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-red-700 flex gap-2 font-medium"
                      >
                        <AlertCircle
                          className="w-3 h-3 mt-0.5 flex-shrink-0"
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
                  className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm transition-all motion-reduce:transition-none shadow-xl shadow-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                >
                  Return to command center
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setResults(null);
                    setRows([]);
                  }}
                  className="w-full py-4 text-gray-500 hover:text-gray-700 font-bold text-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-2xl"
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
