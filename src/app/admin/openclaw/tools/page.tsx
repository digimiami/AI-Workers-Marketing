import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";
import { assertOrgOperator } from "@/services/org/assertOrgAccess";
import { TOOLS } from "@/lib/openclaw/tools/tools";
import { ToolTester } from "@/app/admin/openclaw/tools/toolTester";

export default async function AdminOpenClawToolsPage() {
  const user = await requireUser();
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  const supabase = await createSupabaseServerClient();
  try {
    await assertOrgOperator(supabase, user.id, orgId);
  } catch {
    redirect("/admin");
  }

  const { data: recent } = await supabase
    .from("openclaw_tool_calls" as never)
    .select("id,trace_id,tool_name,ok,error_code,created_at,run_id,campaign_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OpenClaw · Tools</h1>
        <p className="text-sm text-muted-foreground">
          Registry, role gating, and recent tool calls (operator-only).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registered tools ({TOOLS.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>High risk</TableHead>
                <TableHead>Allowed roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TOOLS.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="font-mono text-xs">{t.name}</TableCell>
                  <TableCell className="text-sm">{t.description}</TableCell>
                  <TableCell className="text-sm">{t.highRisk ? "yes" : "no"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.allowedRoles.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent tool calls (50)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Trace</TableHead>
                <TableHead>OK</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recent ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No tool calls yet.
                  </TableCell>
                </TableRow>
              ) : (
                (recent ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.tool_name}</TableCell>
                    <TableCell className="font-mono text-xs">{String(r.trace_id).slice(0, 18)}…</TableCell>
                    <TableCell className="text-sm">{r.ok ? "yes" : "no"}</TableCell>
                    <TableCell className="text-xs text-destructive">{r.error_code ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ToolTester organizationId={orgId} />
    </div>
  );
}

