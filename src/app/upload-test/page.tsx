import { ImageUpload } from "@/components/upload/ImageUpload";
import { useState } from "react";
import { useSession } from "next-auth/react";

export default function TestUploadPage() {
  const { data: session, status } = useSession();
  const [images, setImages] = useState<string[]>([]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Image Upload System Test</h1>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <p>
          <strong>Session Status:</strong> {status}
        </p>
        <p>
          <strong>User ID:</strong> {session?.user?.id || "Not logged in"}
        </p>
        <p>
          <strong>Email:</strong> {session?.user?.email || "-"}
        </p>
      </div>

      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
        <label className="block text-sm font-medium mb-2">Test Component</label>
        <ImageUpload
          value={images}
          onChange={setImages}
          onRemove={(url) => setImages((prev) => prev.filter((i) => i !== url))}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Debug Data</h2>
        <pre className="bg-black text-green-400 p-4 rounded-lg text-xs overflow-auto">
          {JSON.stringify(
            { imageCount: images.length, urls: images, session: session?.user },
            null,
            2,
          )}
        </pre>
      </div>
    </div>
  );
}
