import { redirect } from "next/navigation";

import { DataSourcesClient } from "@/app/admin/data-sources/DataSourcesClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminDataSourcesPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  return <DataSourcesClient organizationId={orgId} />;
}

