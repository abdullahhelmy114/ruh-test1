import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

// Phase 3 batch 1 — public projection.
// This route is public (its only consumer is the AI assistant in
// /api/ai/chat, which pastes the whole payload into a prompt). It used to
// return `SELECT *` from nine tables. Each section below now selects an
// explicit column list containing only catalog/marketing data:
//   - no user or teacher identifiers (teacher_uid, user_uid, admin_uid, admin_id)
//   - no paid or internal content (course.content, recording_url,
//     model/live course `scenario`, knowledge_base chunk text and embeddings)
//   - no checkout links (payment_url) or moderation/state columns
//   - only published/active rows where such a flag exists
// Response keys are unchanged.

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

async function rows(query: string): Promise<Record<string, unknown>[]> {
  try {
    const result = (await getSql().query(query)) as any;
    const data = Array.isArray(result) ? result : result?.rows;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("academy-info query failed:", e);
    return [];
  }
}

async function countRows(table: string, distinctColumn?: string) {
  try {
    const sql = getSql();
    if (distinctColumn) {
      const result = (await sql.query(
        `SELECT COUNT(DISTINCT "${distinctColumn}")::int AS count FROM "${table}";`
      )) as any;
      const r = Array.isArray(result) ? result : result?.rows;
      return r?.[0]?.count || 0;
    }
    const result = (await sql.query(`SELECT COUNT(*)::int AS count FROM "${table}";`)) as any;
    const r = Array.isArray(result) ? result : result?.rows;
    return r?.[0]?.count || 0;
  } catch (e) {
    console.warn(`countRows failed for ${table}:`, e);
    return 0;
  }
}

export async function GET() {
  try {
    const data: any = {
      staticPages: [],
      courses: [],
      modelCourses: [],
      liveCourses: [],
      bundles: [],
      categories: [],
      blogPosts: [],
      knowledgeBase: [],
      reviews: [],
      stats: {
        totalCourses: 0,
        totalStudents: 0,
        totalLessons: 0,
        totalQuizzes: 0,
      },
    };

    data.staticPages = await rows(
      `SELECT slug, title, content FROM static_pages ORDER BY slug LIMIT 10;`
    );
    data.courses = await rows(
      `SELECT id, title, description, level, price, old_price, lessons_count,
              course_duration, lesson_duration, instructor_name, image_url,
              thumbnail_url, intro_video_url, launch_date, category_id, theme
       FROM course WHERE is_published = true ORDER BY created_at DESC LIMIT 100;`
    );
    data.modelCourses = await rows(
      `SELECT id, title, category, level, price, description
       FROM model_course ORDER BY created_at DESC LIMIT 50;`
    );
    data.liveCourses = await rows(
      `SELECT id, title, category, level, price
       FROM live_course WHERE status = 'active' ORDER BY created_at DESC LIMIT 50;`
    );
    data.bundles = await rows(
      `SELECT id, title, description, price, course_ids FROM bundles ORDER BY created_at DESC LIMIT 20;`
    );
    data.categories = await rows(
      `SELECT id, name, name_ar, slug, description, parent_id
       FROM categories WHERE is_active IS DISTINCT FROM false ORDER BY order_index, name LIMIT 50;`
    );
    data.blogPosts = await rows(
      `SELECT id, title, content, image_url, created_at FROM blog_posts ORDER BY created_at DESC LIMIT 10;`
    );
    // Library corpus: titles only. Chunk text is protected content and the
    // embedding vectors are internal.
    data.knowledgeBase = await rows(
      `SELECT DISTINCT book_title FROM knowledge_base ORDER BY book_title LIMIT 20;`
    );
    data.reviews = await rows(
      `SELECT course_id, rating, comment, created_at FROM reviews ORDER BY created_at DESC LIMIT 20;`
    );

    data.stats.totalCourses = await countRows("course");
    data.stats.totalStudents = await countRows("enrollments", "user_uid");
    data.stats.totalLessons = await countRows("lessons");
    data.stats.totalQuizzes = await countRows("quizzes");

    return NextResponse.json(data);
  } catch (error) {
    console.error("Academy Info error:", error);
    return NextResponse.json(
      { error: "Failed to fetch academy info" },
      { status: 500 }
    );
  }
}
