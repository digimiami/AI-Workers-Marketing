import { Suspense } from "react";
import { redirect } from "next/navigation";

import { MyAgentsClient } from "@/app/admin/my-agents/MyAgentsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function MyAgentsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <MyAgentsClient organizationId={orgId} />
    </Suspense>
  );
}
