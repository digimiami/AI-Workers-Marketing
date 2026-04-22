import { redirect } from "next/navigation";

import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { LaunchClient } from "@/app/admin/launch/LaunchClient";

export default async function AdminLaunchPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  return <LaunchClient organizationId={orgId} />;
}

