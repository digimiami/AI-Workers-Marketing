import { err, ok, type Result } from "@/lib/result";

export type HttpError = {
  message: string;
  status?: number;
  code?: string;
  cause?: unknown;
};

export type FetchJsonOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<Result<T, HttpError>> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 30_000,
    retries = 0,
    retryDelayMs = 500,
  } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const e: HttpError = {
          message: `HTTP ${res.status} ${res.statusText}`,
          status: res.status,
          cause: text,
        };
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
        return err(e);
      }

      const json = (await res.json()) as T;
      return ok(json);
    } catch (cause) {
      const e: HttpError = {
        message: cause instanceof Error ? cause.message : "Request failed",
        code: cause instanceof DOMException ? cause.name : undefined,
        cause,
      };
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      return err(e);
    } finally {
      clearTimeout(t);
    }
  }

  return err({ message: "Request failed" });
}

