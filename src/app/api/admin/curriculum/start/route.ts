// src/app/api/admin/curriculum/start/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { groqJSONCompletion, simpleGroqCompletion } from "@/lib/groq-client";
import { generateSpeechBase64 } from "@/lib/tts/edge-tts";
import { uploadFileToGoogleDrive } from "@/lib/google-drive";

async function verifyAdmin(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`SELECT id, role FROM profiles WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    if (result.length > 0 && result[0].role === "admin") {
      return result[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

interface LessonOutline {
  title: string;
  description?: string;
}

interface GenerationSettings {
  courseId: string;
  level?: string;
  instructions?: string;
  generateAudio?: boolean;
  generateVideo?: boolean;
  quizCount?: number;
  sourceText?: string;
}

/**
 * تحويل قيمة من قاعدة البيانات إلى JSON بأمان
 */
function safeJsonParse(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * توليد محتوى HTML كامل للدرس باستخدام Gemini (نص حر، ليس JSON)
 * مع طلب درس طويل ومفصل مناسب لمدة 45-60 دقيقة، مع قائمة كلمات وجمل وقصة وأسئلة.
 */
async function generateLessonHtml(
  outline: LessonOutline,
  level: string,
  instructions: string,
  allSourceText: string
): Promise<string> {
  const systemPrompt = `أنت خبير تعليمي في تأليف مناهج اللغة العربية للناطقين بغيرها.
تكتب دروسًا كاملة ومطولة تصلح لحصة 45-60 دقيقة.
تستخدم اللغة العربية الفصحى، وتكتب بصيغة HTML منسقة مع دعم RTL (اتجاه من اليمين لليسار).
تستخدم وسوم HTML مثل h2, h3, p, ul, ol, li, table, blockquote, img.
تحرص على جعل الدرس غنيًا بالمحتوى التفاعلي والأنشطة.

استخدم الأوامر السحرية التالية لضمان أفضل جودة:
- /teacher : أسلوب معلم صبور يشرح بوضوح وأمثلة سهلة.
- /step_by_step : تقسيم الشرح لخطوات تدريجية.
- /simplify : تبسيط المفاهيم المعقدة للطلاب المبتدئين.
- /storyteller : نسج قصة قصيرة مشوقة تحتوي على الكلمات الجديدة.
- /hook_maker : كتابة مقدمة جذابة تشد انتباه الطالب.
- /clarity : تحويل الأفكار إلى نقاط واضحة ومفهومة.
- /deep_dive : تقديم شرح معمق مع أمثلة إضافية وتطبيقات.
- /precision : دقة متناهية في اختيار الكلمات والتشكيل والصياغة.

استخدم جميع هذه الأوامر في كتابة الدرس لتحقيق أفضل نتيجة.`;
  const userPrompt = `
عنوان الدرس: ${outline.title}
وصف الدرس: ${outline.description || ""}
المستوى: ${level}
التعليمات: ${instructions}

النص المرجعي (قد يكون مقتطعًا):
"""
${allSourceText.slice(0, 12000)}
"""

المطلوب:
اكتب درسًا تعليميًا متكاملًا وطويلًا جدًا بصيغة HTML مع الإعدادات التالية:
- يجب أن يكون الاتجاه RTL (dir="rtl") في جميع الأقسام.
- لا يقل الدرس عن 2000 كلمة.
- ابدأ بوسم <div dir="rtl"> وانتهِ بوسم </div>.

الدرس يجب أن يشمل الأقسام التالية بالترتيب:

1. **المقدمة** (100-150 كلمة) — استخدم /hook_maker لكتابة افتتاحية جذابة.
2. **أهداف التعلم** (قائمة من 4-5 أهداف)
3. **قائمة الكلمات الجديدة** (جدول من 5-8 كلمات):
   - الكلمة (مع التشكيل)
   - المعنى باللغة الإنجليزية أو لغة وسيطة (ممنوع استخدام لغة وسيطة في الجمل، فقط في المعنى)
   - صيغة الجمع (إن كانت مفردة) أو المفرد (إن كانت جمعًا)
   - المضاد (إن وُجد)
   - صورة معبرة عن المعنى: استخدم <img src="https://source.unsplash.com/300x200/?[كلمة بالإنجليزية]" alt="[الكلمة]" style="width:150px;border-radius:8px;"> أو رابط صورة من Unsplash يشبه المعنى.
4. **جمل لكل كلمة** (لكل كلمة):
   - 3 جمل متنوعة باستخدام الكلمة مع الضمائر (أنا، هو، هي، هم) أو حالات مختلفة.
   - بعد كل جملة، ضع 3 أسئلة قصيرة لاختبار فهم الطالب لمعنى الكلمة واستخدامها (أسئلة اختيار من متعدد أو صح/خطأ).
   - استخدم <ul> أو <ol> لتنظيم الأسئلة.
5. **قصة قصيرة** (150-200 كلمة):
   - استخدم /storyteller لنسج قصة مشوقة تحتوي على جميع الكلمات الجديدة ومتعلقاتها.
   - مناسبة لمستوى الطالب.
   - مكتوبة بلغة بسيطة.
6. **أنشطة وتدريبات**:
   - 5 أسئلة "املأ الفراغ"
   - 5 أسئلة "اختيار من متعدد"
   - 5 أسئلة "توصيل بين قائمتين" (استخدم جدولًا)
   - 4 أسئلة "صح أو خطأ"
   - 2 سؤال "كوّن جملة من مجموعة كلمات"
   - 1 سؤال "اكتب فقرة من سطرين مستخدمًا كلمات الدرس"
7. **ملخص الدرس** (50-80 كلمة) — استخدم /clarity لتلخيص النقاط الأساسية.
8. **واجب منزلي** (نشاط إضافي)

تأكد من:
- استخدام وسوم HTML بشكل صحيح.
- عدم الخروج عن التنسيق المطلوب.
- إدراج صور تعبيرية للكلمات الجديدة قدر الإمكان (استخدم روابط صور Unsplash أو Pexels).
- جعل الدرس جذابًا بصريًا.

اكتب مباشرة HTML بدون أي مقدمات خارجية.
`;

  const response = await simpleGroqCompletion(userPrompt, systemPrompt, {
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    temperature: 0.7,
    max_tokens: 30000,
  });

  // تنظيف الناتج: إزالة علامات code fences إن وجدت
  let cleaned = response.trim();
  if (cleaned.startsWith("```html")) {
    cleaned = cleaned.replace(/^```html\s*/, "").replace(/```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "");
  }

  return cleaned;
}

/**
 * توليد اختبار قصير للدرس (يستخدم JSON)
 */
async function generateQuizForLesson(
  outline: LessonOutline,
  level: string,
  count: number,
  sourceText: string
): Promise<any[]> {
  const systemPrompt = `أنت خبير في توليد اختبارات تعليمية. أعد الأسئلة بصيغة JSON.

استخدم الأوامر السحرية التالية لضمان الدقة:
- /precision : اجعل كل سؤال دقيقًا وواضحًا.
- /clarity : تأكد من وضوح الخيارات وعدم الغموض.
- /teacher : صغ الأسئلة بأسلوب تربوي مناسب للمستوى.`;

  const userPrompt = `
أنشئ ${count} أسئلة متنوعة (اختيار من متعدد، صح/خطأ، أكمل الفراغ) بناءً على درس بعنوان: "${outline.title}".
المستوى: ${level}

النص المرجعي:
"""
${sourceText.slice(0, 10000)}
"""

أعد JSON بالشكل:
{
  "questions": [
    {
      "question_type": "choice",
      "question_text": "نص السؤال",
      "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
      "correct_answer": "الإجابة الصحيحة",
      "explanation": "شرح مختصر"
    }
  ]
}
`;

  const parsed = await groqJSONCompletion<{ questions: any[] }>(userPrompt, systemPrompt, {
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    temperature: 0.7,
    max_tokens: 6000,
  });

  return parsed.questions || [];
}

/**
 * تحويل الأسئلة المولّدة إلى صيغة QuizBlockData المتوافقة مع المحرر
 */
function convertQuestionsForQuizBlock(questions: any[]): any[] {
  return questions.map((q: any) => {
    const optionsArray = Array.isArray(q.options)
      ? q.options.map((opt: string, idx: number) => ({
          label: String.fromCharCode(65 + idx),
          text: opt,
        }))
      : [];

    let correctIndex = 0;
    if (q.correct_answer && Array.isArray(q.options)) {
      correctIndex = q.options.findIndex((opt: string) => opt === q.correct_answer);
      if (correctIndex === -1) correctIndex = 0;
    }

    return {
      question: q.question_text || q.question || "",
      options: optionsArray,
      correctIndex,
      explanation: q.explanation || "",
    };
  });
}

/**
 * توليد صوت لجملة ورفعه إلى Google Drive وإرجاع الرابط
 */
async function generateAndUploadAudio(
  text: string,
  voice: string = "ar-SA-HamedNeural"
): Promise<string> {
  const base64 = await generateSpeechBase64(text, voice);
  const buffer = Buffer.from(base64, "base64");
  const url = await uploadFileToGoogleDrive(
    buffer,
    `audio-${Date.now()}.mp3`,
    "audio/mpeg"
  );
  return url;
}

/**
 * البحث عن فيديو يوتيوب حسب العنوان
 */
async function searchYouTubeVideo(query: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(
        query
      )}&type=video&key=${apiKey}`
    );
    const data = await res.json();
    const videoId = data.items?.[0]?.id?.videoId;
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

/**
 * معالجة مهمة التوليد في الخلفية
 */
async function processCurriculumTask(taskId: string) {
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const taskRes = await sql`
      SELECT * FROM curriculum_tasks WHERE id = ${taskId} LIMIT 1
    `;
    if (taskRes.length === 0) return;
    const task = taskRes[0];

    const settings = safeJsonParse(task.settings_json) || {};
    const lessonsOutlines = safeJsonParse(task.lessons_json) || [];
    const allSourceText = task.source_text || "";

    const courseId = task.course_id;
    const teacherUid = task.user_id; // سيتم استخدامه كـ firebase_uid في lessons
    const level = settings.level || "A1";
    const instructions = settings.instructions || "";
    const quizCount = settings.quizCount || 10;
    const generateAudio = settings.generateAudio || false;
    const generateVideo = settings.generateVideo || false;

    const totalLessons = lessonsOutlines.length;
    let completedLessons = 0;

    await sql`
      UPDATE curriculum_tasks
      SET status = 'processing', updated_at = now()
      WHERE id = ${taskId}
    `;

    for (const outline of lessonsOutlines) {
      // 1) توليد HTML كامل
      const html = await generateLessonHtml(outline, level, instructions, allSourceText);

      // 2) توليد اختبار
      const questions = await generateQuizForLesson(outline, level, quizCount, allSourceText);

      // 3) توليد صوتيات (اختياري)
      let audioBlocks: any[] = [];
      if (generateAudio) {
        try {
          const firstSentence = outline.description || outline.title;
          const audioUrl = await generateAndUploadAudio(firstSentence);
          audioBlocks.push({
            id: Date.now().toString(),
            title: "استمع",
            src: audioUrl,
            voice: "ar-SA-HamedNeural",
            theme: "green",
          });
        } catch (audioError) {
          console.error("Audio generation failed:", audioError);
        }
      }

      // 4) توليد فيديو يوتيوب (اختياري)
      let videoEmbed = "";
      if (generateVideo) {
        const videoUrl = await searchYouTubeVideo(outline.title);
        if (videoUrl) {
          videoEmbed = `<div class="video-wrapper" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin:1rem 0;"><iframe src="${videoUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%;" allowfullscreen></iframe></div>`;
        }
      }

      // 5) تجميع المحتوى مع تحويل الأسئلة إلى صيغة QuizBlock
      const fullHtml = html + videoEmbed;
      const convertedQuestions = convertQuestionsForQuizBlock(questions);
      const contentJson = {
        html: fullHtml,
        audio: audioBlocks,
        quiz: [
          {
            id: Date.now().toString() + Math.random(),
            title: "Interactive Quiz",
            currentQuestionIndex: 0,
            questions: convertedQuestions,
          },
        ],
      };

      // 6) إدراج الدرس في جدول lessons
      await sql`
        INSERT INTO lessons (course_id, teacher_uid, title, status, content, created_at)
        VALUES (${courseId}, ${teacherUid}, ${outline.title}, 'approved', ${JSON.stringify(
        contentJson
      )}, now())
      `;

      completedLessons++;
      await sql`
        UPDATE curriculum_tasks
        SET completed_lessons = ${completedLessons}, updated_at = now()
        WHERE id = ${taskId}
      `;

      // مهلة صغيرة
      await new Promise((r) => setTimeout(r, 2000));
    }

    await sql`
      UPDATE curriculum_tasks
      SET status = 'completed', completed_lessons = ${totalLessons}, updated_at = now()
      WHERE id = ${taskId}
    `;
  } catch (error: any) {
    console.error("Error processing curriculum task:", error);
    await sql`
      UPDATE curriculum_tasks
      SET status = 'failed', error_message = ${error.message}, updated_at = now()
      WHERE id = ${taskId}
    `;
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { courseId, lessons, settings } = body;

    if (!courseId || !Array.isArray(lessons) || lessons.length === 0) {
      return NextResponse.json(
        { error: "courseId and lessons array are required" },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    const taskRes = await sql`
      INSERT INTO curriculum_tasks (user_id, course_id, status, total_lessons, completed_lessons)
      VALUES (${adminId}, ${courseId}, 'pending', ${lessons.length}, 0)
      RETURNING id
    `;
    const taskId = taskRes[0].id;

    const sourceText = settings?.sourceText || "";

    await sql`
      UPDATE curriculum_tasks
      SET
        lessons_json = ${JSON.stringify(lessons)},
        settings_json = ${JSON.stringify(settings || {})},
        source_text = ${sourceText}
      WHERE id = ${taskId}
    `;

    processCurriculumTask(taskId);

    return NextResponse.json({ success: true, taskId });
  } catch (error: any) {
    console.error("Error starting curriculum task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start task" },
      { status: 500 }
    );
  }
}