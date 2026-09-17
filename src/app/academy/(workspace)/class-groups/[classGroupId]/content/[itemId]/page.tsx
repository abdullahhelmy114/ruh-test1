"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { answersFromResponses, ItemInput, responsesFromAnswers, type AnswerMap } from "@/components/academy/workspace/assessment-items";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { OpenedContent } from "@/components/academy/workspace/types";
import { ApiView, Badge, Button, Card, FailureNotice, LinkButton, Notice, PageHeader, Section } from "@/components/academy/workspace/ui";
import { projectForLearner, type AssessmentItem, type LearnerItem } from "@/lib/academy/assessment/content";

interface Story {
  readonly pages: readonly { readonly id: string; readonly text: string; readonly translation: string | null }[];
}
interface Adventure {
  readonly startSceneId: string;
  readonly scenes: readonly { readonly id: string; readonly text: string; readonly ending: boolean; readonly choices: readonly { readonly id: string; readonly label: string; readonly targetSceneId: string }[] }[];
}
interface Media {
  readonly mediaType: "image" | "audio" | "video" | "document";
  readonly url: string;
  readonly altText: string | null;
  readonly transcript: string | null;
}
interface Scored {
  readonly instructions?: string | null;
  readonly items: readonly (LearnerItem | AssessmentItem)[];
}

/** Items as a learner sees them. Staff receive full items; the same answer-free projection is applied for the player. */
function playableItems(items: readonly (LearnerItem | AssessmentItem)[], staff: boolean): readonly LearnerItem[] {
  return staff ? projectForLearner({ instructions: null, items: items as AssessmentItem[] }).items : (items as LearnerItem[]);
}

// Published 2C content linked to the class group's course.
export default function ContentPage() {
  const { classGroupId, itemId } = useParams<{ classGroupId: string; itemId: string }>();
  const { t } = useWorkspace();
  const { state, reload } = useApi<OpenedContent>(api.contentItem(classGroupId, itemId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(opened) => (
        <>
          <PageHeader back={{ href: pages.classGroup(classGroupId, "practice"), label: t.lesson.back }} title={opened.item.title} intro={<Badge>{opened.item.kind}</Badge>} />
          <Player opened={opened} classGroupId={classGroupId} />
        </>
      )}
    </ApiView>
  );
}

function Player({ opened, classGroupId }: { readonly opened: OpenedContent; readonly classGroupId: string }) {
  const { role } = useAuth();
  const staff = role === "teacher" || role === "admin";
  switch (opened.item.kind) {
    case "activity":
    case "game":
      return <ScoredPlayer content={opened.content as Scored} classGroupId={classGroupId} itemId={opened.item.id} staff={staff} />;
    case "story":
      return <StoryPlayer story={opened.content as Story} />;
    case "adventure":
      return <AdventurePlayer adventure={opened.content as Adventure} />;
    case "media":
      return <MediaPlayer media={opened.content as Media} />;
    default:
      return null;
  }
}

function ScoredPlayer({ content, classGroupId, itemId, staff }: { readonly content: Scored; readonly classGroupId: string; readonly itemId: string; readonly staff: boolean }) {
  const { t, fmt } = useWorkspace();
  const items = playableItems(content.items, staff);
  const [answers, setAnswers] = useState<AnswerMap>(() => answersFromResponses({}));
  const [result, setResult] = useState<{ scorePercent: number; itemResults: readonly { itemId: string; correct: boolean | null }[] } | null>(null);
  const started = useRef(Date.now());
  const action = useAction();

  async function submit() {
    const durationSeconds = Math.max(1, Math.round((Date.now() - started.current) / 1000));
    const response = await action.run<{ scorePercent: number; itemResults: { itemId: string; correct: boolean | null }[] }>(api.contentItem(classGroupId, itemId), "POST", {
      responses: responsesFromAnswers(items, answers),
      durationSeconds,
    });
    if (response.ok) setResult(response.data);
  }

  return (
    <Section title={t.classGroup.tabs.practice}>
      {content.instructions && <p className="mb-4 whitespace-pre-line">{content.instructions}</p>}
      <ol className="space-y-4">
        {items.map((item, index) => {
          const outcome = result?.itemResults.find((r) => r.itemId === item.id);
          return (
            <li key={item.id} className="rounded-md border p-4">
              <p className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium" dir="auto">
                  {index + 1}. {item.prompt}
                </span>
                {outcome && <Badge tone={outcome.correct ? "strong" : "warning"}>{outcome.correct ? t.attempt.correct : t.attempt.incorrect}</Badge>}
              </p>
              <ItemInput item={item} answer={answers[item.id]} disabled={staff || result !== null} onChange={(answer) => setAnswers((a) => ({ ...a, [item.id]: answer }))} />
            </li>
          );
        })}
      </ol>
      {action.failure && (
        <div className="mt-4">
          <FailureNotice failure={action.failure} />
        </div>
      )}
      {result ? (
        <div className="mt-4 space-y-3">
          <Notice tone="success">{fmt(t.attempt.score, { earned: result.itemResults.filter((r) => r.correct).length, max: result.itemResults.length, percent: result.scorePercent })}</Notice>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResult(null);
              setAnswers({});
              started.current = Date.now();
            }}
          >
            {t.common.retry}
          </Button>
        </div>
      ) : (
        !staff && (
          <div className="mt-4">
            <Button type="button" busy={action.busy} onClick={() => void submit()}>
              {t.common.submit}
            </Button>
          </div>
        )
      )}
    </Section>
  );
}

function StoryPlayer({ story }: { readonly story: Story }) {
  const { t, fmt } = useWorkspace();
  const [index, setIndex] = useState(0);
  const page = story.pages[index];
  if (!page) return null;
  return (
    <Card>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {fmt(t.library.page, { page: index + 1 })} / {story.pages.length}
      </p>
      <p dir="auto" className="whitespace-pre-line text-xl leading-loose">
        {page.text}
      </p>
      {page.translation && <p className="mt-2 text-muted-foreground">{page.translation}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          {t.library.previous}
        </Button>
        <Button type="button" variant="outline" disabled={index === story.pages.length - 1} onClick={() => setIndex((i) => i + 1)}>
          {t.library.next}
        </Button>
      </div>
    </Card>
  );
}

function AdventurePlayer({ adventure }: { readonly adventure: Adventure }) {
  const { t } = useWorkspace();
  const [sceneId, setSceneId] = useState(adventure.startSceneId);
  const scene = adventure.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  return (
    <Card>
      <p dir="auto" className="whitespace-pre-line text-lg leading-relaxed" aria-live="polite">
        {scene.text}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {scene.choices.map((choice) => (
          <Button key={choice.id} type="button" variant="outline" onClick={() => setSceneId(choice.targetSceneId)}>
            {choice.label}
          </Button>
        ))}
        {scene.ending && (
          <Button type="button" onClick={() => setSceneId(adventure.startSceneId)}>
            {t.common.retry}
          </Button>
        )}
      </div>
    </Card>
  );
}

function MediaPlayer({ media }: { readonly media: Media }) {
  const { t } = useWorkspace();
  return (
    <Card>
      {media.mediaType === "image" && (
        // eslint-disable-next-line @next/next/no-img-element -- authored https media from any host
        <img src={media.url} alt={media.altText ?? ""} className="h-auto max-w-full rounded-md" referrerPolicy="no-referrer" />
      )}
      {media.mediaType === "audio" && <audio controls preload="none" src={media.url} className="w-full" />}
      {media.mediaType === "video" && <video controls preload="none" src={media.url} className="w-full rounded-md" />}
      {media.mediaType === "document" && (
        <LinkButton href={media.url} external>
          {t.common.open}
        </LinkButton>
      )}
      {media.transcript && (
        <details className="mt-3">
          <summary className="cursor-pointer">{t.lesson.transcript}</summary>
          <p className="mt-2 whitespace-pre-line">{media.transcript}</p>
        </details>
      )}
    </Card>
  );
}
