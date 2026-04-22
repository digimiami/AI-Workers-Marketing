import { handleCloudToolsRunPost } from "@/lib/api/cloudToolsRunPost";

/** Versioned public URL for cloud / OpenClaw agent tool calls (same behavior as /api/openclaw/tools/run). */
export async function POST(request: Request) {
  return handleCloudToolsRunPost(request);
}
