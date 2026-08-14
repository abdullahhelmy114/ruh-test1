import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

async function fetchAllRows(table: string, limit = 20) {
  try {
    const sql = getSql();
    const result = (await sql.query(`SELECT * FROM "${table}" LIMIT ${limit};`)) as any;
    const rows = Array.isArray(result) ? result : result?.rows;
    if (!Array.isArray(rows)) {
      console.warn(`Unexpected result format for ${table}:`, result);
      return [];
    }
    return rows;
  } catch (e) {
    console.warn(`fetchAllRows failed for ${table}:`, e);
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
      const rows = Array.isArray(result) ? result : result?.rows;
      return rows?.[0]?.count || 0;
    }
    const result = (await sql.query(`SELECT COUNT(*)::int AS count FROM "${table}";`)) as any;
    const rows = Array.isArray(result) ? result : result?.rows;
    return rows?.[0]?.count || 0;
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

    data.staticPages = await fetchAllRows("static_pages", 10);
    data.courses = await fetchAllRows("course", 100);
    data.modelCourses = await fetchAllRows("model_course", 50);
    data.liveCourses = await fetchAllRows("live_course", 50);
    data.bundles = await fetchAllRows("bundles", 20);
    data.categories = await fetchAllRows("categories", 50);
    data.blogPosts = await fetchAllRows("blog_posts", 10);
    data.knowledgeBase = await fetchAllRows("knowledge_base", 20);
    data.reviews = await fetchAllRows("reviews", 20);

    data.stats.totalCourses = await countRows("course");
    data.stats.totalStudents = await countRows("enrollments", "user_uid"); // ✅ تعديل هنا
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