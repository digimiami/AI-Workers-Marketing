import { createOrganizationAction, selectOrganizationAction } from "@/app/admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listMyOrganizations } from "@/services/org/orgService";

export default async function AdminOnboardingPage() {
  const orgs = await listMyOrganizations().catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace setup</h1>
        <p className="text-sm text-muted-foreground">
          Select an organization or create a new one.
        </p>
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

