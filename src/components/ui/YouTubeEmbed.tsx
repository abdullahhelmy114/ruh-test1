// src/components/ui/YouTubeEmbed.tsx
import { cn } from "@/lib/utils";

interface YouTubeEmbedProps {
  url: string;              // رابط YouTube مثل https://youtu.be/abc123
  title?: string;
  className?: string;
}

/**
 * استخراج معرف الفيديو من رابط YouTube
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubeEmbed({ url, title, className }: YouTubeEmbedProps) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return (
      <div className="rounded-2xl bg-muted p-6 text-center text-muted-foreground">
        Invalid video URL
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-elegant bg-black",
        className
      )}
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title={title || "Lesson Recording"}
      />
    </div>
  );
}