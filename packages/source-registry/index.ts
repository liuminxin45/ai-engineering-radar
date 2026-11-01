import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  sourceSchema,
  type Source,
  type Company,
  type Publisher,
} from "../shared/types.js";

export async function loadRegistry() {
  const identifier = z.string().regex(/^[a-z0-9-]+$/);
  const raw = z
    .object({
      schemaVersion: z.literal(1),
      companies: z.array(
        z.object({
          id: identifier,
          name: z.string().min(1),
          region: z.enum(["cn", "global"]),
        }),
      ),
      publishers: z.array(
        z.object({
          id: identifier,
          companyId: identifier,
          name: z.string().min(1),
        }),
      ),
      sources: z.array(sourceSchema),
    })
    .parse(
      JSON.parse(
        await readFile(new URL("./registry.json", import.meta.url), "utf8"),
      ),
    );
  const sources: Source[] = raw.sources.map((s: unknown) =>
    sourceSchema.parse(s),
  );
  const companies: Company[] = raw.companies;
  const publishers: Publisher[] = raw.publishers;
  for (const [name, records] of Object.entries({
    companies,
    publishers,
    sources,
  })) {
    const ids = records.map((r) => r.id);
    if (new Set(ids).size !== ids.length)
      throw new Error(`Duplicate ${name} id`);
  }
  for (const p of publishers)
    if (!companies.some((c) => c.id === p.companyId))
      throw new Error(`Unknown company: ${p.companyId}`);
  for (const s of sources)
    if (!publishers.some((p) => p.id === s.publisherId))
      throw new Error(`Unknown publisher: ${s.publisherId}`);
  for (const s of sources) {
    if (
      [
        "csdn-feed",
        "cnblogs-account",
        "tencent-news",
        "tencent-user",
        "tencent-column",
        "segmentfault-feed",
        "team-blog-feed",
        "juejin-account",
      ].includes(s.platform) &&
      s.crawl.enabled &&
      !s.authorAllowlist?.length
    )
      throw new Error(
        `Community source needs reviewed account identifiers: ${s.id}`,
      );
    if (
      s.platform === "csdn-feed" &&
      s.crawl.enabled &&
      (!s.linkPattern || new URL(s.url).hostname !== "rss.csdn.net")
    )
      throw new Error(
        `CSDN feeds require account-scoped entry and article path: ${s.id}`,
      );
  }
  return { sources, companies, publishers };
}
export type Registry = Awaited<ReturnType<typeof loadRegistry>>;
