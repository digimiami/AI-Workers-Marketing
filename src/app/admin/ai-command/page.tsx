import { redirect } from "next/navigation";

import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAiCommandCenterPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  const sp = props.searchParams ? await props.searchParams : {};
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0]) q.set(k, v[0]);
  }
  const suffix = q.toString();
  redirect(suffix ? `/admin/workspace?${suffix}` : "/admin/workspace");
}
