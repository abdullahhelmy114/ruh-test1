// src/app/api/categories/[id]/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

// PUT: تعديل تصنيف (أدمن فقط)
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;
    const body = await req.json();
    const { name, name_ar, slug, description, parent_id } = body;

    // التحقق من وجود التصنيف
    const [existing] = await sql`SELECT id FROM categories WHERE id = ${id}`;
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // لو تم تغيير الـ slug، نتأكد أنه غير مستخدم
    if (slug) {
      const [slugExists] = await sql`
        SELECT id FROM categories WHERE slug = ${slug} AND id != ${id}
      `;
      if (slugExists) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
    }

    // لا يمكن جعل التصنيف أباً لنفسه
    if (parent_id && parent_id === id) {
      return NextResponse.json(
        { error: "A category cannot be its own parent" },
        { status: 400 }
      );
    }

    const [updated] = await sql`
      UPDATE categories
      SET
        name = COALESCE(${name ?? null}, name),
        name_ar = COALESCE(${name_ar ?? null}, name_ar),
        slug = COALESCE(${slug ?? null}, slug),
        description = COALESCE(${description ?? null}, description),
        parent_id = ${parent_id !== undefined ? parent_id : sql`parent_id`}
      WHERE id = ${id}
      RETURNING id, name, name_ar, slug, description, parent_id, created_at
    `;

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: حذف تصنيف (أدمن فقط)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = params;

    // التحقق من وجود التصنيف
    const [category] = await sql`SELECT id, parent_id FROM categories WHERE id = ${id}`;
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // هل يوجد تصنيفات فرعية تابعة له؟
    const [children] = await sql`
      SELECT COUNT(*)::int AS count FROM categories WHERE parent_id = ${id}
    `;
    if (children.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with subcategories. Remove or reassign them first." },
        { status: 400 }
      );
    }

    // حذف الروابط مع الكتب (الجدول الوسيط)
    await sql`DELETE FROM book_categories WHERE category_id = ${id}`;

    // حذف التصنيف نفسه
    await sql`DELETE FROM categories WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}