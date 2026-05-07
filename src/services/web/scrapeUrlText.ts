export type ScrapeResult = {
  url: string;
  finalUrl: string;
  title: string | null;
  contentText: string;
  contentChars: number;
};

function normalizeWhitespace(s: string) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripHtml(html: string) {
  // Remove non-content and scripts/styles.
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Extract title (best-effort).
  const titleMatch = withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? normalizeWhitespace(titleMatch[1].replace(/<[^>]+>/g, " ")) : null;

  // Remove tags and decode a few common entities.
  const text = withoutScripts
    .replace(/<\/(p|div|section|article|header|footer|main|br|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return { title, text: normalizeWhitespace(text) };
}

export async function scrapeUrlTextOrThrow(input: { url: string; minChars?: number; timeoutMs?: number }): Promise<ScrapeResult> {
  const minChars = input.minChars ?? 500;
  const timeoutMs = input.timeoutMs ?? 20000;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(input.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; AiWorkersBot/1.0; +https://aiworkers.vip) AppleWebKit/537.36 (KHTML, like Gecko)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) throw new Error(`Scraping failed — HTTP ${res.status}`);

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("text/html")) {
    // Still allow if the server doesn't set proper headers, but we should be strict for obvious non-HTML.
    if (ct && !ct.toLowerCase().includes("application/xhtml+xml")) {
      throw new Error(`Scraping failed — unsupported content-type: ${ct}`);
    }
  }

  const html = await res.text();
  const { title, text } = stripHtml(html);
  if (!text || text.length < minChars) {
    throw new Error("Scraping failed — insufficient content");
  }

  return {
    url: input.url,
    finalUrl: res.url || input.url,
    title,
    contentText: text,
    contentChars: text.length,
  };
}

