export type ActiveTool = "summary" | "translate" | "ai-writer" | null;

export interface AudioBlockData {
  id: string;
  title: string;
  narrator?: string;
  duration?: string;
  currentTime?: string;
  isPlaying?: boolean;
  textToRead?: string;
  audioUrl?: string;
  waveformHeights: number[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string; label: string }[];
  correctIndex: number;
  explanation?: string;
}

export interface QuizBlockData {
  id: string;
  title: string;
  currentQuestionIndex: number;
  questions: QuizQuestion[];
}

export interface LessonScript {
  id: string;
  title: string;
  subtitle: string;
  grade: string;
  subject: string;
  status: string;
  fontFamily: "serif" | "sans" | "mono";
  fontSize: number;
  contentHtml: string;
  audioBlocks: AudioBlockData[];
  quizBlocks: QuizBlockData[];
}