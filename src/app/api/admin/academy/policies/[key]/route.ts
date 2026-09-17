import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { policyService } from "@/lib/academy/server";

const ACTIONS = ["set", "reset_to_inherited"] as const;

// Sets a value at the academy, program or course level, or removes an override.
export const PATCH = withApi<{ key: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { key } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  switch (action) {
    case "set":
      return NextResponse.json(
        {
          data: await policyService.setValue(user, {
            key,
            scope: body.scope,
            scopeId: body.scopeId,
            value: body.value,
            reason: body.reason,
            expectedRevision: body.expectedRevision,
            correlationId,
          }),
        },
        { headers: PRIVATE_NO_STORE },
      );
    case "reset_to_inherited":
      return NextResponse.json(
        {
          data: await policyService.resetToInherited(user, {
            key,
            scope: body.scope,
            scopeId: body.scopeId,
            reason: body.reason,
            expectedRevision: body.expectedRevision,
            correlationId,
          }),
        },
        { headers: PRIVATE_NO_STORE },
      );
  }
});
