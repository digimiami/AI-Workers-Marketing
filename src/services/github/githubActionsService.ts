import { env } from "@/lib/env";

type DispatchParams = {
  workflowFile: string;
  ref: string;
  inputs?: Record<string, string>;
};

export function isGitHubActionsConfigured() {
  return Boolean(
    env.server.GITHUB_ACTIONS_TOKEN &&
      env.server.GITHUB_REPO_OWNER &&
      env.server.GITHUB_REPO_NAME,
  );
}

export async function dispatchWorkflow(params: DispatchParams) {
  if (!env.server.GITHUB_ACTIONS_TOKEN) throw new Error("GITHUB_ACTIONS_TOKEN not configured");
  if (!env.server.GITHUB_REPO_OWNER) throw new Error("GITHUB_REPO_OWNER not configured");
  if (!env.server.GITHUB_REPO_NAME) throw new Error("GITHUB_REPO_NAME not configured");

  const url = `https://api.github.com/repos/${encodeURIComponent(env.server.GITHUB_REPO_OWNER)}/${encodeURIComponent(
    env.server.GITHUB_REPO_NAME,
  )}/actions/workflows/${encodeURIComponent(params.workflowFile)}/dispatches`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.server.GITHUB_ACTIONS_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "aiworkers-vip",
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: params.ref,
      inputs: params.inputs ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub workflow dispatch failed (${res.status}): ${text || res.statusText}`);
  }
}

