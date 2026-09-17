/**
 * Example structures for new 2C content drafts, one per content kind. Each
 * passes the server's content parser as is (checked in tests), so an editor
 * can start from a valid shape and replace the example text.
 */
import type { ContentKind } from "../production/content.ts";

export const CONTENT_TEMPLATES: Readonly<Record<ContentKind, unknown>> = {
  activity: {
    instructions: "Choose the correct answer.",
    items: [
      { id: "q1", type: "choice", prompt: "Which word means “book”?", options: ["قلم", "كتاب", "باب"], correctIndex: 1 },
      { id: "q2", type: "true_false", prompt: "كتاب is a noun.", correct: true },
    ],
  },
  story: {
    pages: [
      { id: "p1", text: "ذهب أحمد إلى المدرسة.", translation: "Ahmad went to school." },
      { id: "p2", text: "قرأ أحمد كتابًا.", translation: "Ahmad read a book." },
    ],
  },
  adventure: {
    startSceneId: "start",
    scenes: [
      { id: "start", text: "أنت في السوق. ماذا تشتري؟", ending: false, choices: [{ id: "c1", label: "خبز", targetSceneId: "bread" }, { id: "c2", label: "تمر", targetSceneId: "dates" }] },
      { id: "bread", text: "اشتريت خبزًا طازجًا.", ending: true },
      { id: "dates", text: "اشتريت تمرًا حلوًا.", ending: true },
    ],
  },
  game: {
    gameType: "quiz_race",
    timeLimitSeconds: 60,
    items: [
      { id: "q1", type: "choice", prompt: "“Door” in Arabic is…", options: ["باب", "بيت"], correctIndex: 0 },
      { id: "q2", type: "fill_blank", prompt: "Transliterate كتاب", acceptedAnswers: ["kitab", "kitaab"] },
    ],
  },
  media: {
    mediaType: "audio",
    url: "https://example.org/audio/lesson-1.mp3",
    altText: null,
    transcript: "Transcript of the recording.",
    durationSeconds: 120,
  },
};
