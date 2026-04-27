"use client";

import * as React from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Reveal } from "@/components/marketing/motion-primitives";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const chartData = [
  { w: "W1", leads: 14, conv: 2.1 },
  { w: "W2", leads: 22, conv: 2.4 },
  { w: "W3", leads: 31, conv: 2.8 },
  { w: "W4", leads: 38, conv: 3.0 },
  { w: "W5", leads: 44, conv: 3.2 },
  { w: "W6", leads: 52, conv: 3.5 },
  { w: "W7", leads: 61, conv: 3.6 },
  { w: "W8", leads: 68, conv: 3.8 },
];

const campaigns = [
  { name: "Semrush AI visibility", stage: "Nurture", leads: "184", cvr: "3.2%", status: "Active" },
  { name: "Q2 bridge test", stage: "Publish", leads: "96", cvr: "2.7%", status: "Active" },
  { name: "Cold outbound assist", stage: "Draft", leads: "42", cvr: "—", status: "Review" },
];

export function HomeResultsPreview() {
  const [chartReady, setChartReady] = React.useState(false);
  React.useEffect(() => {
    setChartReady(true);
  }, []);

  return (
    <Reveal>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="group relative rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-card/45 md:p-5">
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
            aria-hidden
          />
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline preview</p>
              <p className="font-display text-sm font-bold text-foreground">Leads vs. conversion (demo)</p>
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Internal
            </Badge>
          </div>
          <div className="relative mt-4 w-full min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background/20">
            <div className="pointer-events-none absolute inset-0 fx-scanlines opacity-0 transition-opacity duration-300 group-hover:opacity-40" />
            {chartReady ? (
              <ResponsiveContainer width="100%" height={220} minWidth={0} debounce={50}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="oklch(0.72 0.14 195)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 10 }} stroke="oklch(0.55 0.02 264)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="oklch(0.55 0.02 264)" width={32} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid oklch(0.88 0.02 264)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke="oklch(0.62 0.16 195)"
                    fill="url(#fillLeads)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div
                className="flex h-[220px] w-full items-end justify-between gap-1 px-2 pb-2 pt-6"
                aria-hidden
              >
                {chartData.map((d) => (
                  <div
                    key={d.w}
                    className="min-w-0 flex-1 rounded-sm bg-primary/25"
                    style={{ height: `${12 + (d.leads / 68) * 72}%` }}
                  />
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Illustrative curve · wire your warehouse for live numbers
          </p>
        </div>

        <div className="group relative rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-card/45 md:p-5">
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 fx-holo-edge group-hover:opacity-100"
            aria-hidden
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campaigns</p>
          <p className="font-display text-sm font-bold text-foreground">Live board snapshot</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Campaign</TableHead>
                  <TableHead className="text-xs font-semibold">Stage</TableHead>
                  <TableHead className="text-xs font-semibold">Leads</TableHead>
                  <TableHead className="text-xs font-semibold">CVR</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.name} className="border-border/50 text-sm">
                    <TableCell className="max-w-[140px] truncate font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.stage}</TableCell>
                    <TableCell>{c.leads}</TableCell>
                    <TableCell>{c.cvr}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={c.status === "Active" ? "secondary" : "outline"} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
