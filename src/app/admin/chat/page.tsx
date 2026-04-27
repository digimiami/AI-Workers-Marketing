import { redirect } from "next/navigation";

import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { ChatAdminClient } from "@/app/admin/chat/ChatAdminClient";

export default async function AdminChatPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Conversations, transcripts, and conversion outcomes from the AI Chat Closer widget.
        </p>
      </div>
      <ChatAdminClient organizationId={orgId} />
    </div>
  );
}

