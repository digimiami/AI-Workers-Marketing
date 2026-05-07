import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";

export type GeneratedContentPost = {
  platform: "tiktok" | "youtube_shorts";
  title: string;
  hook: string;
  script: string;
  caption: string;
  cta: string;
};

function safeParsePosts(text: string): GeneratedContentPost[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const posts = Array.isArray((parsed as any)?.posts) ? ((parsed as any).posts as unknown[]) : [];
    return posts
      .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
      .map((p) => ({
        platform: String(p.platform) === "youtube_shorts" ? ("youtube_shorts" as const) : ("tiktok" as const),
        title: String(p.title ?? "").slice(0, 120),
        hook: String(p.hook ?? "").slice(0, 180),
        script: String(p.script ?? ""),
        caption: String(p.caption ?? "").slice(0, 500),
        cta: String(p.cta ?? "").slice(0, 160),
      }))
      .filter((p) => p.title && p.script && p.caption);
  } catch {
    return [];
  }
}

function fallbackPosts(input: { goal: string; audience: string; campaignName: string; ctaLink: string }) {
  const angles = [
    "costly mistake",
    "fast path",
    "before and after",
    "myth teardown",
    "simple checklist",
    "decision shortcut",
  ];
  const posts: GeneratedContentPost[] = [];
  for (const platform of ["tiktok", "youtube_shorts"] as const) {
    for (let i = 0; i < 30; i += 1) {
      const angle = angles[i % angles.length];
      const title = `${input.goal}: ${angle} #${i + 1}`;
      const hook = `If you're ${input.audience}, this is the ${angle} that decides whether ${input.goal.toLowerCase()} works.`;
      posts.push({
        platform,
        title,
        hook,
        script: [
          hook,
          `Problem: most people try to solve it with a generic funnel or vague ad copy.`,
          `Shift: start with the buyer outcome, then build the landing page and follow-up around that exact intent.`,
          `Next step: use the campaign page to launch the funnel and route traffic to the best variant.`,
        ].join("\n"),
        caption: `${input.campaignName}: get a specific funnel, ads, and follow-up path built around ${input.goal}.`,
        cta: `Launch the campaign: ${input.ctaLink}`,
      });
    }
  }
  return posts;
}

export async function generateContentBatch(input: {
  organizationId: string;
  campaignId: string;
  campaignName: string;
  goal: string;
  audience: string;
  ctaLink: string;
}) {
  const fallback = { posts: fallbackPosts(input) };
  const out = await runStrictJsonPrompt({
    system: [
      "You generate short-form social content for a growth SaaS campaign.",
      "Return ONLY valid JSON. No markdown. No code fences.",
      "No generic motivational content. Every post must connect to the campaign outcome and CTA.",
    ].join("\n"),
    user: JSON.stringify(
      {
        task: "Generate 60 short-form posts: 30 TikTok scripts and 30 YouTube Shorts scripts.",
        inputs: {
          campaignName: input.campaignName,
          goal: input.goal,
          audience: input.audience,
          ctaLink: input.ctaLink,
        },
        required_json_shape: {
          posts: [
            {
              platform: "tiktok|youtube_shorts",
              title: "string",
              hook: "string",
              script: "string",
              caption: "string",
              cta: "string",
            },
          ],
        },
        rules: [
          "Exactly 30 posts for tiktok and exactly 30 posts for youtube_shorts.",
          "Each script must have: hook, problem, useful insight, CTA.",
          "Avoid vague phrases like 'unlock your potential'.",
          "CTA must point to ctaLink.",
        ],
      },
      null,
      2,
    ),
    fallbackJsonText: JSON.stringify(fallback),
  });

  const posts = safeParsePosts(out.jsonText);
  return { posts: posts.length ? posts : fallback.posts, meta: out.meta };
}

export async function scheduleContentPosting(input: {
  organizationId: string;
  campaignId: string;
  userId?: string | null;
  posts: GeneratedContentPost[];
  startAt?: Date;
  spacingMinutes?: number;
}) {
  const admin = createSupabaseAdminClient();
  const start = input.startAt ?? new Date(Date.now() + 60 * 60_000);
  const spacing = input.spacingMinutes ?? 240;
  const rows = input.posts.map((p, idx) => ({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    campaign_id: input.campaignId,
    platform: p.platform,
    title: p.title,
    script: p.script,
    caption: p.caption,
    cta_link: p.cta,
    status: "scheduled",
    scheduled_at: new Date(start.getTime() + idx * spacing * 60_000).toISOString(),
    metadata: { hook: p.hook, source: "content_engine" },
  }));
  const { data, error } = await admin.from("content_posts" as never).insert(rows as never).select("id");
  if (error) throw new Error(error.message);
  return { scheduled: ((data ?? []) as Array<{ id: string }>).map((r) => String(r.id)) };
}

export async function contentPublisherWorker(input: { organizationId?: string; limit?: number }) {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("content_posts" as never)
    .select("id,organization_id,campaign_id,platform,title,scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(input.limit ?? 50);
  if (input.organizationId) q = q.eq("organization_id", input.organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const posted: string[] = [];
  for (const row of (data ?? []) as any[]) {
    const now = new Date().toISOString();
    await admin
      .from("content_posts" as never)
      .update({ status: "posted", posted_at: now, updated_at: now, metadata: { publisher_mode: "stub", published_stub_at: now } } as never)
      .eq("id", String(row.id))
      .eq("organization_id", String(row.organization_id));
    await admin.from("analytics_events" as never).insert({
      organization_id: String(row.organization_id),
      campaign_id: row.campaign_id ? String(row.campaign_id) : null,
      event_name: "content_posted",
      source: "content_publisher_worker",
      properties: { platform: row.platform, post_id: row.id, title: row.title, mode: "stub" },
      created_at: now,
    } as never);
    posted.push(String(row.id));
  }
  return { processed: (data ?? []).length, posted };
}

