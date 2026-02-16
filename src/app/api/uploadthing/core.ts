import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";
 
const f = createUploadthing();
 
const handleAuth = async () => {
  console.log("UploadThing: Checking auth...");
  const session = await auth();
  console.log("UploadThing: Session:", session?.user?.id);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return { userId: session.user.id };
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
