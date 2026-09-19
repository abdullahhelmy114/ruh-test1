import { NextResponse } from "next/server";
import { DomainError } from "@/lib/academy/domain/errors";
import { publicService } from "@/lib/academy/server";

// Public site facts for the assistant: its only consumer is /api/ai/chat,
// which pastes the whole payload into its prompt on every chat turn.
//
// It used to read nine legacy tables (course, model_course, live_course,
// bundles, categories, reviews, static_pages, blog_posts, knowledge_base)
// and count four more. None of them is part of the academy schema that
// production runs, so every chat turn logged "relation ... does not exist"
// for each. It now reports the published academy catalog: the same
// programs and courses (slug, title, description, program) that /academy
// shows, from the same public service, with the page for each.
export async function GET() {
  try {
    const catalog = await publicService.catalog();
    return NextResponse.json({
      catalogPage: "/academy",
      programs: catalog.programs.map((program) => ({ ...program, page: `/academy/programs/${program.slug}` })),
      courses: catalog.courses.map((course) => ({ ...course, page: `/academy/courses/${course.slug}` })),
    });
  } catch (error) {
    // Before the academy schema is ready there is no catalog to describe; the assistant says so.
    if (error instanceof DomainError && error.code === "FEATURE_UNAVAILABLE") {
      return NextResponse.json({ catalogPage: "/academy", programs: [], courses: [] });
    }
    console.error("Academy Info error: the academy catalog could not be read");
    return NextResponse.json({ error: "Failed to fetch academy info" }, { status: 500 });
  }
}
