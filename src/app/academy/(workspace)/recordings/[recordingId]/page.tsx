"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { Recording } from "@/components/academy/workspace/types";
import { ApiView, Badge, Card, KeyValues, LinkButton, Notice, PageHeader } from "@/components/academy/workspace/ui";

function youTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.hostname.endsWith("youtube.com")) return parsed.searchParams.get("v");
  } catch {
    return null;
  }
  return null;
}

// A session recording. The media link is present only when the server allows watching.
export default function RecordingPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const { t, fmt, date } = useWorkspace();
  const { state, reload } = useApi<Recording>(api.recording(recordingId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(recording) => {
        const embed = recording.mediaUrl ? youTubeId(recording.mediaUrl) : null;
        return (
          <>
            <PageHeader back={{ href: pages.classGroup(recording.classGroupId, "recordings"), label: t.lesson.back }} title={recording.title} />
            <Card className="mb-4">
              <KeyValues
                items={[
                  ...(recording.publishedAt ? [{ label: t.common.details, value: date(recording.publishedAt) }] : []),
                  ...(recording.durationSeconds ? [{ label: t.common.ends, value: fmt(t.recordings.duration, { count: Math.round(recording.durationSeconds / 60) }) }] : []),
                  ...(recording.state ? [{ label: t.common.status, value: <Badge>{recording.state}</Badge> }] : []),
                  ...(recording.availableUntil ? [{ label: t.common.ends, value: fmt(t.classGroup.availableUntil, { date: date(recording.availableUntil) }) }] : []),
                ]}
              />
            </Card>
            {!recording.mediaUrl ? (
              <Notice tone="warning">{recording.unavailableReason ? t.classGroup.unavailableReason[recording.unavailableReason] : t.recordings.unavailable}</Notice>
            ) : (
              <div className="space-y-3">
                {embed ? (
                  <div className="aspect-video w-full overflow-hidden rounded-md border">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(embed)}`}
                      title={recording.title}
                      className="h-full w-full"
                      allow="encrypted-media; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                ) : (
                  <LinkButton href={recording.mediaUrl} variant="primary" external>
                    {t.recordings.watch}
                  </LinkButton>
                )}
                <p className="text-sm text-muted-foreground">{recording.downloadAllowed ? t.recordings.download : t.recordings.noDownload}</p>
              </div>
            )}
          </>
        );
      }}
    </ApiView>
  );
}
