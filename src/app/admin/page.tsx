import { redirect } from "next/navigation";

import { AdminOverviewDashboard } from "@/app/admin/AdminOverviewDashboard";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminOverviewPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AdminOverviewDashboard organizationId={orgId} />;
}

