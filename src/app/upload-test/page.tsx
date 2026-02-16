'use client';

import { ImageUpload } from '@/components/upload/ImageUpload';
import { useState } from 'react';

export default function TestUploadPage() {
  const [images, setImages] = useState<string[]>([]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Image Upload System Test</h1>
      
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <label className="block text-sm font-medium mb-2">Test Component</label>
        <ImageUpload 
            value={images}
            onChange={setImages}
            onRemove={(url) => setImages(prev => prev.filter(i => i !== url))}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Debug Data</h2>
        <pre className="bg-black text-green-400 p-4 rounded-lg text-xs overflow-auto">
            {JSON.stringify({ imageCount: images.length, urls: images }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
