type LeadLike = {
  email: string;
  full_name?: string | null;
};

function firstName(fullName: string | null | undefined) {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? null;
}

export function renderEmailMarkdown(
  markdown: string,
  params: {
    lead: LeadLike;
    unsubscribeUrl: string;
  },
) {
  const replacements: Record<string, string> = {
    "{{email}}": params.lead.email,
    "{{full_name}}": params.lead.full_name ?? "",
    "{{first_name}}": firstName(params.lead.full_name) ?? "",
    "{{unsubscribe_url}}": params.unsubscribeUrl,
  };

  let out = markdown ?? "";
  for (const [k, v] of Object.entries(replacements)) {
    out = out.split(k).join(v);
  }
  return out;
}

