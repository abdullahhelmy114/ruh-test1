// src/app/api/categories/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

// GET: جلب جميع التصنيفات الرئيسية (مع التصنيفات الفرعية اختيارياً)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parentOnly = searchParams.get("parentOnly") === "true";

    let query;
    if (parentOnly) {
      // نجلب التصنيفات الرئيسية التي ليس لها أب
      query = sql`
        SELECT id, name, name_ar, slug, description, parent_id, created_at
        FROM categories
        WHERE parent_id IS NULL
        ORDER BY name ASC
      `;
    } else {
      // نجلب جميع التصنيفات
      query = sql`
        SELECT id, name, name_ar, slug, description, parent_id, created_at
        FROM categories
        ORDER BY name ASC
      `;
    }

    const categories = await query;
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: إضافة تصنيف جديد (أدمن فقط)
export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, name_ar, slug, description, parent_id } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // slug يجب أن يكون فريداً
    const [existing] = await sql`SELECT id FROM categories WHERE slug = ${slug}`;
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const [newCategory] = await sql`
      INSERT INTO categories (name, name_ar, slug, description, parent_id)
      VALUES (${name}, ${name_ar || null}, ${slug}, ${description || null}, ${parent_id || null})
      RETURNING id, name, name_ar, slug, description, parent_id, created_at
    `;

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}