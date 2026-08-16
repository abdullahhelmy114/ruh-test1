// src/lib/tts/edge-tts.ts
// توليد ملفات صوتية باستخدام Edge TTS (مجاني، جودة عالية)
// يتطلب تثبيت الحزمة: npm install edge-tts

// @ts-ignore - edge-tts may not have TypeScript declarations
const { Communicate } = require("edge-tts");

export interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

/**
 * توليد صوت من نص باستخدام Edge TTS وإرجاعه كـ base64
 * @param text النص المراد تحويله لصوت
 * @param voice اسم الصوت (افتراضياً: ar-SA-HamedNeural)
 * @returns base64 data URL
 */
export async function generateSpeechBase64(
  text: string,
  voice: string = "ar-SA-HamedNeural"
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text is required");
  }

  const communicate = new Communicate(text, voice);
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    communicate
      .stream((chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      })
      .then(() => resolve())
      .catch((err: any) => reject(err));
  });

  const audioBuffer = Buffer.concat(chunks);
  return audioBuffer.toString("base64");
}

/**
 * توليد صوت وحفظه في ملف
 * @param text النص المراد تحويله
 * @param voice اسم الصوت
 * @param outputPath مسار الحفظ (مثل: /tmp/audio.mp3)
 */
export async function generateSpeechToFile(
  text: string,
  voice: string = "ar-SA-HamedNeural",
  outputPath: string
): Promise<void> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text is required");
  }

  const communicate = new Communicate(text, voice);
  await communicate.save(outputPath);
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