import { redirect } from "next/navigation";

import { EmailClient } from "@/app/admin/email/EmailClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminEmailPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <EmailClient organizationId={orgId} />;
}

