'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { bulkCreateAuctions } from '@/actions/bulk-auction';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  Download,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function BulkUploadPage() {
  const t = useTranslations('Auction');
  const [items, setItems] = useState<BulkAuctionItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<{ success: number; failures: number; errors: { index: number; error: string; details?: unknown }[] } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Map CSV headers to our schema
        const mapped = (results.data as Record<string, string>[]).map((row) => ({
          title: row.title,
          description: row.description,
          category: row.category?.toLowerCase() || 'electronics',
          startingPrice: Number(row.startingPrice || 100),
          minBidIncrement: Number(row.minBidIncrement || 10),
          startTime: row.startTime, // Should be ISO or compatible
          endTime: row.endTime,
          location: row.location?.toLowerCase() || 'mirpur',
          condition: (row.condition?.toUpperCase() || 'USED') as 'NEW' | 'USED' | 'REFURBISHED',
          images: row.images ? row.images.split('|') : [],
        }));
        setItems(mapped);
        toast.success(`Parsed ${mapped.length} items from CSV`);
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    });
  };

  const handleProcess = () => {
    startTransition(async () => {
      const res = await bulkCreateAuctions(items);
      if (res.success) {
        setResults({
          success: res.data!.successCount,
          failures: res.data!.failureCount,
          errors: res.data!.errors
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
    const headers = ['title', 'description', 'category', 'startingPrice', 'minBidIncrement', 'startTime', 'endTime', 'location', 'condition', 'images'];
    const sample = ['Vintage Watch', 'Classic 1970s watch', 'collectibles', '5000', '100', '2026-06-01T10:00', '2026-06-05T10:00', 'mirpur', 'USED', 'https://example.com/img1.jpg|https://example.com/img2.jpg'];
    const csv = Papa.unparse([headers, sample]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nilamit_bulk_template.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Bulk Inventory Upload</h1>
            <p className="text-gray-500 text-sm font-medium mt-1">Professional tools for high-volume retailers.</p>
          </div>
          
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download CSV Template
          </button>
        </div>

        {!results ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">1. Upload CSV</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Upload your inventory file. Make sure it follows our template structure for flawless synchronization.
                  </p>
                </div>

                <label className="group relative block w-full aspect-square cursor-pointer">
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  <div className="absolute inset-0 border-2 border-dashed border-gray-200 rounded-3xl group-hover:border-primary-500 transition-all flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-4 bg-gray-50 rounded-2xl mb-4 group-hover:scale-110 group-hover:bg-primary-50 transition-all">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary-600" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 mb-1">Click to browse</span>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">CSV files only</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                    Queue Preview ({items.length} items)
                  </h3>
                  {items.length > 0 && (
                    <button 
                      onClick={() => setItems([])}
                      className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-auto max-h-[500px]">
                  {items.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4">Title</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Start Price</th>
                          <th className="px-6 py-4">Condition</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                         {items.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-gray-900 truncate max-w-[200px]">{item.title}</td>
                            <td className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">{item.category}</td>
                            <td className="px-6 py-4 text-sm font-black text-primary-600">৳{item.startingPrice}</td>
                            <td className="px-6 py-4">
                              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-gray-100 text-gray-500">{item.condition}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                      <div className="p-4 bg-gray-50 rounded-full mb-4">
                        <FileSpreadsheet className="w-12 h-12 text-gray-200" />
                      </div>
                      <p className="text-gray-400 text-sm font-medium">Your upload queue is currently empty.</p>
                    </div>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="p-6 bg-gray-50 border-t border-gray-100">
                    <button
                      onClick={handleProcess}
                      disabled={isPending}
                      className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                      Sync {items.length} Items to Marketplace
                    </button>
                    <p className="text-[10px] text-gray-400 text-center mt-3 font-medium">
                      By proceeding, you agree to our Retailer Policy. All listings will be public immediately.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-10 text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Sync Complete</h2>
              <p className="text-gray-500 mb-8">Process finished with the following results:</p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
                  <div className="text-3xl font-black text-emerald-600 mb-1">{results.success}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-800/50">Successful</div>
                </div>
                <div className={`p-6 border rounded-3xl ${results.failures > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <div className={`text-3xl font-black ${results.failures > 0 ? 'text-red-600' : 'text-gray-400'}`}>{results.failures}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Failed</div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="text-left mb-8 max-h-48 overflow-auto bg-red-50/50 rounded-2xl border border-red-50 p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-red-800/50 mb-2">Error Log</h4>
                  <ul className="space-y-1.5">
                    {results.errors.map((err, i) => (
                      <li key={i} className="text-[11px] text-red-700 flex gap-2 font-medium">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>Item #{err.index + 1}: {err.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Link 
                  href="/retailer/dashboard"
                  className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-sm transition-all shadow-xl shadow-gray-200"
                >
                  Return to Command Center
                </Link>
                <button 
                  onClick={() => { setResults(null); setItems([]); }}
                  className="w-full py-4 text-gray-500 hover:text-gray-700 font-bold text-sm transition-all"
                >
                  Upload Another File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
