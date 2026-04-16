import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";
import { assertOrgMember, assertOrgOperator } from "@/services/org/assertOrgAccess";

export const orgIdQuery = z.object({
  organizationId: z.string().uuid(),
});

export async function withOrgMember(organizationId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await assertOrgMember(supabase, user.id, organizationId);
  } catch {
    return { error: NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }) };
  }
  return { user, supabase, error: null as null };
}

export async function withOrgOperator(organizationId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  try {
    await assertOrgOperator(supabase, user.id, organizationId);
  } catch {
    return { error: NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 }) };
  }
  return { user, supabase, error: null as null };
}

/** Maps orchestration `throw new Error("CODE")` to HTTP for run / approval decisions. */
export function openclawDecisionErrorResponse(e: unknown) {
  if (!(e instanceof Error)) {
    return NextResponse.json({ ok: false, message: "Unexpected error" }, { status: 500 });
  }
  const code = e.message;
  const messages: Record<string, string> = {
    NO_PENDING_APPROVAL:
      "This run is not waiting on a human approval. Either the agent does not require sign-off, or a decision was already recorded.",
    RUN_NOT_FOUND: "Run not found.",
    INVALID_RUN_STATE_FOR_APPROVAL:
      "Only a successful run with a pending approval queue entry can be approved.",
    INVALID_RUN_STATE_FOR_REJECTION:
      "Only a successful run with a pending approval queue entry can be rejected.",
    ALREADY_APPROVED: "This run was already approved and cannot be rejected.",
    APPROVAL_ALREADY_DECIDED: "This approval request was already approved or rejected.",
  };
  if (code in messages) {
    return NextResponse.json({ ok: false, message: messages[code], code }, { status: 409 });
  }
  return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
}
