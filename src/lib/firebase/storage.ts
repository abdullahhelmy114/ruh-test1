import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getApp } from "firebase/app";
import { v4 as uuidv4 } from "uuid";

function getFirebaseStorage() {
  try {
    const app = getApp(); // التطبيق الافتراضي المهيأ في العميل
    return getStorage(app);
  } catch {
    throw new Error("Firebase app not initialized");
  }
}

export async function uploadFile(file: File, folder: string): Promise<string> {
  const storage = getFirebaseStorage();
  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${uuidv4()}.${ext}`;
  const storageRef = ref(storage, fileName);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
}