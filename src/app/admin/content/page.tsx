import { redirect } from "next/navigation";

import { ContentClient } from "@/app/admin/content/ContentClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminContentPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <ContentClient organizationId={orgId} />;
}
