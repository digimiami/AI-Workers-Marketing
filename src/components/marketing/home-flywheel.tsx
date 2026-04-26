import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const months = [
  {
    title: "Month 1: Foundation and chaos",
    body: "Baseline offer + funnel, seed telemetry, capture the messy reality. Build the Single Brain.",
  },
  {
    title: "Month 2: Connect and learn",
    body: "Connect data sources, run workers weekly, and turn outputs into repeatable operating patterns.",
  },
  {
    title: "Month 3: Scale and automate",
    body: "Approval-gated automation, more workers, faster execution, fewer manual handoffs.",
  },
  {
    title: "Month 4: Optimize and own",
    body: "Optimization loops driven by analytics + reality checks. Your team owns the system.",
  },
];

export function HomeFlywheel() {
  return (
    <section className="border-t border-border/50 bg-muted/10">
      <div className="mkt-page py-12 md:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">4-month flywheel</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
            From chaos to a compounding operating system
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The goal isn’t “more AI.” It’s a workforce that learns together inside one shared brain—with humans controlling
            risk.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {months.map((m) => (
            <Card key={m.title} className="border-border/70 bg-card/70 backdrop-blur-md dark:border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">{m.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{m.body}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

