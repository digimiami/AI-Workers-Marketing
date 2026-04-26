import { createOrganizationAction, selectOrganizationAction } from "@/app/admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listMyOrganizations } from "@/services/org/orgService";

export default async function AdminOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const orgs = await listMyOrganizations().catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace setup</h1>
        <p className="text-sm text-muted-foreground">
          Select an organization or create a new one. Your workspace is the Single Brain that stores campaigns, funnels,
          leads, content, approvals, logs, and context for every worker.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08]">
          <CardHeader>
            <CardTitle className="text-base">Human in control</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            High-risk actions route through approvals, audit logs, and manual overrides. Workers are fast—humans decide what
            ships.
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08]">
          <CardHeader>
            <CardTitle className="text-base">4-month flywheel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Month 1: foundation + chaos. Month 2: connect + learn. Month 3: scale + automate. Month 4: optimize + own.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orgs.length ? (
              <form action={selectOrganizationAction} className="space-y-3">
                <label className="text-sm font-medium" htmlFor="orgId">
                  Organization
                </label>
                <select
                  id="orgId"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  name="orgId"
                  defaultValue={orgs[0]?.id}
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.slug})
                    </option>
                  ))}
                </select>
                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                No organizations found. Create one to continue.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createOrganizationAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input name="name" placeholder="AiWorkers" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input name="slug" placeholder="aiworkers" required />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and dashes.
                </p>
              </div>
              <Button type="submit" className="w-full">
                Create workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

