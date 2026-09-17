import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { assessmentService } from "@/lib/academy/server";

const ACTIONS = ["save", "submit", "grade", "release", "return"] as const;

// Learners: their own attempt (results once released). Graders: the full attempt.
export const GET = withApi<{ attemptId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { attemptId } = await ctx.params;
  return NextResponse.json({ data: await assessmentService.getAttempt(user, attemptId) }, { headers: PRIVATE_NO_STORE });
});

// save/submit: the attempt's learner. grade/release/return: the class group's teachers and administrators.
export const PATCH = withApi<{ attemptId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { attemptId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  const expectedRevision = body.expectedRevision;
  switch (action) {
    case "save":
      return NextResponse.json({ data: await assessmentService.saveAttempt(user, attemptId, { responses: body.responses, expectedRevision }) }, { headers: PRIVATE_NO_STORE });
    case "submit":
      return NextResponse.json(
        { data: await assessmentService.submitAttempt(user, attemptId, { responses: body.responses, expectedRevision, correlationId }) },
        { headers: PRIVATE_NO_STORE },
      );
    case "grade":
      return NextResponse.json(
        { data: await assessmentService.gradeAttempt(user, attemptId, { scores: body.scores, feedback: body.feedback, expectedRevision, correlationId }) },
        { headers: PRIVATE_NO_STORE },
      );
    case "release":
      return NextResponse.json({ data: await assessmentService.releaseAttempt(user, attemptId, { expectedRevision, correlationId }) }, { headers: PRIVATE_NO_STORE });
    case "return":
      return NextResponse.json(
        { data: await assessmentService.returnAttempt(user, attemptId, { feedback: body.feedback, expectedRevision, correlationId }) },
        { headers: PRIVATE_NO_STORE },
      );
  }
});
