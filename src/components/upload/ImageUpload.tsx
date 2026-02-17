"use client";

import { X, Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";

interface ImageUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
  onRemove: (value: string) => void;
}

export function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
  const { data: session } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (!session?.user?.id) {
        toast.error("You must be logged in to upload images");
        return;
      }

      setIsUploading(true);

      const newUrls: string[] = [...value];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `auctions/${session.user.id}/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from("auction-images")
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("auction-images").getPublicUrl(filePath);

        newUrls.push(publicUrl);
      }

      onChange(newUrls);
      toast.success("Images uploaded successfully");
    } catch (error: any) {
      console.error("Upload Error:", error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!mounted) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        {value.map((url) => (
          <div
            key={url}
            className="relative w-[200px] h-[200px] rounded-md overflow-hidden border border-gray-100 shadow-sm"
          >
            <div className="z-10 absolute top-2 right-2">
              <button
                type="button"
                onClick={() => onRemove(url)}
                className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition shadow-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Image fill className="object-cover" alt="Image" src={url} />
          </div>
        ))}
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-primary-200 bg-primary-50/50 hover:bg-primary-50 cursor-pointer transition-colors rounded-xl p-8 flex flex-col items-center justify-center gap-2 group"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onUpload}
          accept="image/*"
          multiple
          className="hidden"
        />
        <Upload className="w-10 h-10 text-primary-400 group-hover:text-primary-500 transition-colors" />
        <p className="text-primary-600 font-medium group-hover:text-primary-700 transition-colors">
          Click to upload images
        </p>
        <p className="text-xs text-gray-400">PNG, JPG, GIF up to 4MB</p>
      </div>

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-primary-600 mt-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
        </div>
      )}
    </div>
  );
}
