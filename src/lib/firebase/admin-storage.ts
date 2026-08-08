import { getAdminStorage } from "@/lib/firebase/admin";
import { v4 as uuidv4 } from "uuid";

export async function uploadFileToFirebaseStorage(
  fileBuffer: Buffer,
  fileName: string,
  folder: string
): Promise<string> {
  const storage = getAdminStorage();
  const bucket = storage.bucket();
  const ext = fileName.split(".").pop() || "bin";
  const destination = `${folder}/${uuidv4()}.${ext}`;
  const file = bucket.file(destination);

  await file.save(fileBuffer, {
    metadata: { contentType: "application/octet-stream" },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
}