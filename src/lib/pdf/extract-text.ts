// src/lib/pdf/extract-text.ts
import { extractText } from "unpdf";

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const arrayBuffer = new Uint8Array(buffer).buffer as ArrayBuffer;
    const result = await extractText(arrayBuffer);

    const text = Array.isArray(result.text)
      ? result.text.join("\n\n")
      : result.text || "";

    return text;
  } catch (error) {
    console.error("Failed to extract text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}