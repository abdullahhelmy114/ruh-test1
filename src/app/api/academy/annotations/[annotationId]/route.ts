import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readJsonObject } from "@/lib/academy/http";
import { lessonSheetService } from "@/lib/academy/server";

const ACTIONS = ["update", "delete"] as const;

// Owner-only. Another person's annotation is reported as not found.
export const PATCH = withApi<{ annotationId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { annotationId } = await ctx.params;
  const body = await readJsonObject(req);
  const action = readAction(body, ACTIONS);
  switch (action) {
    case "update":
      return NextResponse.json(
        {
          data: await lessonSheetService.updateAnnotation(user, annotationId, {
            kind: body.kind,
            color: body.color,
            body: body.body,
            expectedRevision: body.expectedRevision,
          }),
        },
        { headers: PRIVATE_NO_STORE },
      );
    case "delete":
      return NextResponse.json(
        { data: await lessonSheetService.deleteAnnotation(user, annotationId, { expectedRevision: body.expectedRevision }) },
        { headers: PRIVATE_NO_STORE },
      );
  }
});
