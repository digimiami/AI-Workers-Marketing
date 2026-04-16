import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminOverviewPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Operational dashboard for campaigns, funnels, leads, and AI workers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Total leads", value: "—" },
          { title: "Affiliate clicks", value: "—" },
          { title: "Conversions", value: "—" },
          { title: "Active campaigns", value: "—" },
          { title: "Active AI workers", value: "—" },
          { title: "Pending approvals", value: "—" },
        ].map((k) => (
          <Card key={k.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {k.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

