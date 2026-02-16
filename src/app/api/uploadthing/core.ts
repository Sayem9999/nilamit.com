import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";
 
const f = createUploadthing();
 
const handleAuth = async () => {
  console.log("UploadThing: 🔒 Middleware started - Checking session...");
  try {
    const session = await auth();
    console.log("UploadThing: 👤 Session found:", session?.user?.email);
    
    if (!session?.user?.id) {
        console.error("UploadThing: ❌ No user ID in session. Rejecting.");
        throw new Error("Unauthorized");
    }
    
    return { userId: session.user.id };
  } catch (err) {
    console.error("UploadThing: 💥 Auth Error:", err);
    throw err;
  }
};
 
export const ourFileRouter = {
  auctionImage: f({ image: { maxFileSize: "4MB", maxFileCount: 4 } })
    .middleware(async () => await handleAuth())
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;
