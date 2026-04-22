"use client";

import { useState } from "react";
import { processBulkUpload } from "@/actions/bulk-upload";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function BulkUploadUI() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ total: number; processed: number; errorCount: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    // Mimicking CSV parsing here for the prototype logic
    // In a real app, use PapaParse or similar
    const dummyRows = [
      {
        title: "Bulk Item 1",
        description: "Batch listing",
        category: "Electronics",
        startingPrice: 1000,
        durationHours: 48,
      },
      {
        title: "Bulk Item 2",
        description: "Batch listing",
        category: "Home",
        startingPrice: 500,
        durationHours: 24,
      },
    ];

    const res = await processBulkUpload(file.name, dummyRows);
    setIsUploading(false);

    if (res.success) {
      setResult({ total: dummyRows.length, processed: res.processed || 0, errorCount: res.errors?.length || 0 });
      toast.success("Bulk upload processed!");
    } else {
      toast.error(res.error || "Upload failed");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
          Bulk Inventory Upload
        </h1>
        <p className="text-gray-500">
          List hundreds of items instantly using CSV templates.
        </p>
      </div>

      {!result ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-6">
            <Upload className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Upload your CSV file
          </h3>
          <p className="text-gray-500 mb-8 max-w-sm">
            Drag and drop your file here, or click to browse. Max file size
            10MB.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 cursor-pointer transition-all active:scale-95 mb-4"
          >
            {file ? file.name : "Select File"}
          </label>

          {file && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center gap-2 text-primary-600 font-bold hover:underline"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  Start Upload <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-lg">
            <a
              href="#"
              className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FileText className="w-4 h-4" /> Download Template
            </a>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 text-amber-500" /> CSV only
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xl shadow-gray-200/50 animate-in zoom-in-95">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Upload Completed
              </h3>
              <p className="text-sm text-gray-500">
                Operation status: Successful ingestion
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">
                Total
              </p>
              <p className="text-2xl font-bold text-gray-900">{result.total}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-2xl">
              <p className="text-xs text-green-600 uppercase font-bold tracking-wider mb-1">
                Success
              </p>
              <p className="text-2xl font-bold text-green-700">
                {result.processed}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-2xl">
              <p className="text-xs text-red-600 uppercase font-bold tracking-wider mb-1">
                Failed
              </p>
              <p className="text-2xl font-bold text-red-700">
                {result.errorCount}
              </p>
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
          >
            Upload More Items
          </button>
        </div>
      )}
    </div>
  );
}
