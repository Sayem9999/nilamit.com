'use client';

import { UploadDropzone } from "@/lib/uploadthing";
import { X, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface ImageUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
  onRemove: (value: string) => void;
}

export function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
        </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        {value.map((url) => (
          <div key={url} className="relative w-[200px] h-[200px] rounded-md overflow-hidden">
            <div className="z-10 absolute top-2 right-2">
              <button
                type="button"
                onClick={() => onRemove(url)}
                className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Image
              fill
              className="object-cover"
              alt="Image"
              src={url}
            />
          </div>
        ))}
      </div>
      <UploadDropzone
        endpoint="auctionImage"
        onUploadBegin={() => {
            setIsUploading(true);
        }}
        onClientUploadComplete={(res) => {
          onChange(res.map((r) => r.url));
          setIsUploading(false);
        }}
        onUploadError={(error: Error) => {
          console.error("UploadThing Error:", error);
          toast.error(`Upload failed: ${error.message}`);
          setIsUploading(false);
        }}
        appearance={{
            container: "border-2 border-dashed border-primary-200 bg-primary-50/50 hover:bg-primary-50 transition-colors rounded-xl p-8",
            uploadIcon: "text-primary-400",
            label: "text-primary-600 hover:text-primary-700",
            allowedContent: "text-gray-400"
        }}
      />
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-primary-600 mt-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
        </div>
      )}
    </div>
  );
}
