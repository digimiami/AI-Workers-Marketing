import { redirect } from "next/navigation";

import { CreationHubClient } from "@/app/admin/creation-hub/CreationHubClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminCreationHubPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <CreationHubClient organizationId={orgId} />;
}
