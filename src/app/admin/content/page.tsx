import { EmptyState } from "@/components/app/EmptyState";

export default function AdminContentPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
        <p className="text-sm text-muted-foreground">
          Content ideas, scripts, captions, platform variants, publishing queue.
        </p>
      </div>
      <EmptyState
        title="No content assets loaded yet"
        description="Next step: connect Content Strategist + Video Worker flows."
        actionHref="/admin/ai-workers"
        actionLabel="Open AI workers"
      />
    </div>
  );
}

