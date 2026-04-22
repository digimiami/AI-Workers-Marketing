"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = { organizationId: string };

export function ToolTester(props: Props) {
  const [toolName, setToolName] = useState("list_campaigns");
  const [traceId, setTraceId] = useState(() => `trace_${Math.random().toString(16).slice(2)}`);
  const [payload, setPayload] = useState<string>(() =>
    JSON.stringify(
      {
        organization_id: props.organizationId,
        trace_id: traceId,
        role_mode: "supervisor",
        approval_mode: "auto",
        tool_name: toolName,
        input: { organizationId: props.organizationId, limit: 5 },
      },
      null,
      2,
    ),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");

  const normalized = useMemo(() => {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [payload]);

  async function run() {
    setRunning(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/openclaw/tools/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
      const json = await res.json().catch(() => ({ ok: false, message: "Invalid JSON response" }));
      setResult(JSON.stringify({ status: res.status, body: json }, null, 2));
    } catch (e) {
      setResult(
        JSON.stringify(
          { ok: false, message: e instanceof Error ? e.message : "Request failed" },
          null,
          2,
        ),
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Manual tool tester (dev/operator)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Tool name</div>
            <Input
              value={toolName}
              onChange={(e) => {
                setToolName(e.target.value);
                setPayload((prev) => prev.replaceAll(/"tool_name":\s*"[^"]*"/g, `"tool_name": "${e.target.value}"`));
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Trace id</div>
            <Input
              value={traceId}
              onChange={(e) => {
                setTraceId(e.target.value);
                setPayload((prev) => prev.replaceAll(/"trace_id":\s*"[^"]*"/g, `"trace_id": "${e.target.value}"`));
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={run} disabled={running || !normalized}>
              {running ? "Running…" : "Run tool"}
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Request JSON</div>
          <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={10} />
          {!normalized ? (
            <div className="text-xs text-destructive">Invalid JSON</div>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Result</div>
          <Textarea value={result} readOnly rows={10} className="font-mono text-xs" />
        </div>
      </CardContent>
    </Card>
  );
}

