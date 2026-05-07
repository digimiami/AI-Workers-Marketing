import { buildFunnelVisualizerUserPrompt, FUNNEL_VISUALIZER_SYSTEM } from "@/ai/prompts/funnel_visualizer.prompt";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

function safeParseRecord(jsonText: string): Record<string, unknown> {
  try {
    const v = JSON.parse(jsonText) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function visualizeFunnelPerformance(input: {
  campaignName: string;
  steps: Array<Record<string, unknown>>;
}): Promise<Record<string, unknown>> {
  const steps =
    input.steps.length > 0
      ? input.steps
      : [
          { stepName: "Landing", visitors: 0, conversions: 0 },
          { stepName: "Capture", visitors: 0, conversions: 0 },
          { stepName: "Thank you", visitors: 0, conversions: 0 },
        ];

  const fallbackJsonText = JSON.stringify({
    overview: "No performance data yet — baseline funnel structure is ready for traffic.",
    steps: steps.map((s) => {
      const name = String((s as any).stepName ?? (s as any).name ?? "Step");
      const visitors = Number((s as any).visitors ?? 0);
      const conversions = Number((s as any).conversions ?? 0);
      const dropOffRate = visitors > 0 ? Math.max(0, Math.min(1, 1 - conversions / Math.max(1, visitors))) : 0;
      return {
        stepName: name,
        visitors,
        conversions,
        dropOffRate,
        problem: visitors === 0 ? "No visitors recorded yet." : "Need more data to isolate the leak.",
        suggestion: "Launch with tracking parameters and collect at least 200 visitors per step.",
      };
    }),
    biggestLeak: "Measurement gap (insufficient traffic volume)",
    optimizationPriority: "Collect baseline traffic + verify tracking fires on all steps.",
  });

  const out = await runStrictJsonPrompt({
    system: FUNNEL_VISUALIZER_SYSTEM,
    user: buildFunnelVisualizerUserPrompt({ campaignName: input.campaignName, steps }),
    fallbackJsonText,
  });
  return safeParseRecord(out.jsonText);
}
