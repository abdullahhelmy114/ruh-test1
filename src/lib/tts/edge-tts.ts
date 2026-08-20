// src/lib/tts/edge-tts.ts
// توليد ملفات صوتية باستخدام Edge TTS (Microsoft Edge Read Aloud) مباشرة عبر fetch
// لا يتطلب أي حزمة خارجية

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

/**
 * الهروب من رموز XML الخاصة
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * توليد صوت من نص باستخدام Edge TTS وإرجاعه base64
 * @param text النص المراد تحويله
 * @param voice اسم الصوت (مثل ar-SA-HamedNeural)
 */
export async function generateSpeechBase64(
  text: string,
  voice: string = "ar-SA-HamedNeural"
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text is required");
  }

  const ssml = `<speak version='1.0' xml:lang='ar-SA'><voice name='${voice}'>${escapeXml(
    text
  )}</voice></speak>`;

  const url =
    "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

  const headers = {
    "Content-Type": "application/ssml+xml",
    "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: ssml,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge TTS API error: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

/**
 * توليد صوت وحفظه في ملف
 * @param text النص
 * @param voice اسم الصوت
 * @param outputPath مسار الحفظ
 */
export async function generateSpeechToFile(
  text: string,
  voice: string = "ar-SA-HamedNeural",
  outputPath: string
): Promise<void> {
  const base64 = await generateSpeechBase64(text, voice);
  const buffer = Buffer.from(base64, "base64");
  const fs = await import("fs/promises");
  await fs.writeFile(outputPath, buffer);
}

/**
 * توليد صوت وإرجاع كائن يحتوي على base64 مع نوع الملف
 */
export async function generateSpeech(
  text: string,
  voice: string = "ar-SA-HamedNeural"
): Promise<TTSResult> {
  const base64 = await generateSpeechBase64(text, voice);
  return {
    audioBase64: base64,
    mimeType: "audio/mpeg",
  };
}