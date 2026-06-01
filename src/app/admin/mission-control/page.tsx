import { redirect } from "next/navigation";

import { MissionControlClient } from "@/app/admin/mission-control/MissionControlClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function MissionControlPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <MissionControlClient organizationId={orgId} />;
}
