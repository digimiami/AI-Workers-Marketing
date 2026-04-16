import { redirect } from "next/navigation";

import { ApprovalsQueueClient } from "@/app/admin/approvals/ApprovalsQueueClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminApprovalsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <ApprovalsQueueClient organizationId={orgId} />;
}
