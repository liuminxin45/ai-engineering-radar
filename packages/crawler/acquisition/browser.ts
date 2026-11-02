import { z } from "zod";
import type { Source } from "../../shared/types.js";
import { reviewedCsdnUrl } from "../platforms/csdn.js";
import type { AcquiredDocument } from "./types.js";

const responseSchema = z.object({
  schemaVersion: z.literal(1),
  document: z.object({
    url: z.string().url(),
    content: z
      .string()
      .min(1)
      .max(8 * 1024 * 1024),
    format: z.literal("html"),
  }),
});
export function createBrowserDocumentClient(
  base = process.env.BROWSER_FETCH_URL,
  transport = fetch,
) {
  if (!base) return undefined;
  const endpoint = new URL(base.endsWith("/") ? base : `${base}/`);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
  )
    throw new Error(
      "BROWSER_FETCH_URL must be HTTPS or a local loopback HTTP service URL",
    );
  return async (source: Source, value: string): Promise<AcquiredDocument> => {
    const url = reviewedCsdnUrl(source, value);
    const response = await transport(new URL("fetch", endpoint), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(125_000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Browser fetch HTTP ${response.status}`);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (response.body)
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > 17 * 1024 * 1024) {
          await response.body.cancel().catch(() => {});
          throw new Error("Browser response exceeds limit");
        }
        chunks.push(chunk);
      }
    const data = responseSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (reviewedCsdnUrl(source, data.document.url) !== url)
      throw new Error("Browser returned a different article");
    return data.document;
  };
}
