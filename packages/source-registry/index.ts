import { readFile } from "node:fs/promises";
import { z } from "zod";
import { validateSourceReplacements } from "./replacements.js";
import { validatePaperSource } from "../crawler/platforms/papers.js";
import { validateMiMoSource } from "../crawler/platforms/xiaomi-mimo.js";
import { validateQwenSource } from "../crawler/platforms/qwen.js";
import { toutiaoAccount } from "../crawler/platforms/toutiao.js";
import {
  sourceSchema,
  type Source,
  type Company,
  type Publisher,
} from "../shared/types.js";

export function validateAccountScope(source: Source) {
  if (!source.crawl.enabled) return;
  if (source.platform === "toutiao-account") {
    toutiaoAccount(source);
    return;
  }
  if (source.contentType === "paper" && !source.platform.startsWith("paper-"))
    throw new Error(
      `Paper sources require an affiliation-verifying adapter: ${source.id}`,
    );
  if (source.platform.startsWith("paper-")) {
    validatePaperSource(source);
    return;
  }
  if (source.platform === "qwen-research") {
    validateQwenSource(source);
    return;
  }
  if (source.platform === "aliyun-profile") {
    const u = new URL(source.url);
    const id = u.pathname.match(/^\/profile\/([a-z0-9]{8,64})$/)?.[1];
    if (
      u.origin !== "https://developer.aliyun.com" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      source.adapter !== "html" ||
      source.entryUrl !== source.url ||
      !id ||
      source.authorAllowlist?.length !== 1 ||
      source.authorAllowlist[0] !== id ||
      source.linkPattern !== "^/article/[0-9]+/?$"
    )
      throw new Error(
        `Aliyun profiles require matching directory and author IDs: ${source.id}`,
      );
    return;
  }
  if (source.platform === "tencent-user") {
    const u = new URL(source.url);
    const id = u.pathname.match(/^\/user\/([0-9]+)\/articles$/)?.[1];
    if (
      source.adapter !== "html" ||
      source.entryUrl !== source.url ||
      u.origin !== "https://developer.cloud.tencent.com" ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !id ||
      source.authorAllowlist?.length !== 1 ||
      source.authorAllowlist[0] !== id ||
      source.linkPattern !== "^/article/[0-9]+/?$"
    )
      throw new Error(
        `Tencent users require matching directory and author IDs: ${source.id}`,
      );
    return;
  }
  if (source.platform === "xiaomi-mimo") {
    validateMiMoSource(source);
    return;
  }
  if (source.platform === "ant-ling-blog") {
    const u = new URL(source.url);
    if (
      source.adapter !== "html" ||
      source.entryUrl !== source.url ||
      u.protocol !== "https:" ||
      u.hostname !== "developer.ant-ling.com" ||
      u.port ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !/^\/zh-CN\/blogs\/?$/.test(u.pathname) ||
      source.authorAllowlist?.length !== 1 ||
      source.authorAllowlist[0] !== "ant-ling"
    )
      throw new Error(
        `Ant Ling requires the reviewed official blog directory: ${source.id}`,
      );
    return;
  }
  if (!["aliyun-group", "volcengine-account"].includes(source.platform)) return;
  const url = new URL(source.url);
  if (!source.authorAllowlist?.length)
    throw new Error(
      `Community source needs reviewed account identifiers: ${source.id}`,
    );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      `Official account endpoint must be an exact HTTPS directory: ${source.id}`,
    );
  if (source.platform === "aliyun-group") {
    if (
      url.hostname !== "developer.aliyun.com" ||
      !/^\/group\/[a-z0-9-]+\/(?:article\/)?$/.test(url.pathname) ||
      source.authorAllowlist.some((id) => !/^[a-z0-9]{8,64}$/.test(id)) ||
      source.linkPattern !== "^/article/[0-9]+/?$"
    )
      throw new Error(
        `Aliyun groups require an official directory and stable profile IDs: ${source.id}`,
      );
  } else {
    const id = url.pathname.match(/^\/user\/([0-9]+)\/?$/)?.[1];
    if (
      url.hostname !== "developer.volcengine.com" ||
      !id ||
      source.authorAllowlist.length !== 1 ||
      source.authorAllowlist[0] !== id ||
      source.linkPattern !== "^/articles/[0-9]+/?$"
    )
      throw new Error(
        `Volcengine accounts require matching directory and author IDs: ${source.id}`,
      );
  }
}

export function validateCompanySources(registry: {
  companies: Company[];
  publishers: Publisher[];
  sources: Source[];
}) {
  const owners = new Map(registry.publishers.map((p) => [p.id, p.companyId]));
  for (const source of registry.sources)
    if (
      !source.crawl.enabled ||
      source.verification.status !== "verified" ||
      source.adapter === "reference"
    )
      throw new Error(
        `Registry contains a non-collectable source: ${source.id}`,
      );
  for (const company of registry.companies) {
    const companySources = registry.sources.filter(
      (source) => owners.get(source.publisherId) === company.id,
    );
    if (!companySources.length)
      throw new Error(`Company must have a collectable source: ${company.id}`);
    const sources = companySources.filter(
      (source) => source.contentType !== "paper",
    );
    const publishers = new Set<string>();
    for (const source of sources) {
      if (publishers.has(source.publisherId))
        throw new Error(
          `Publisher may have at most one blog source: ${source.publisherId}`,
        );
      publishers.add(source.publisherId);
    }
  }
}

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
    validateAccountScope(s);
    if (
      [
        "csdn-feed",
        "toutiao-account",
        "cnblogs-account",
        "tencent-news",
        "tencent-user",
        "tencent-column",
        "segmentfault-feed",
        "team-blog-feed",
        "juejin-account",
        "aliyun-group",
        "volcengine-account",
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
  const registry = { sources, companies, publishers };
  if (
    sources.some(
      (s) => s.contentType === "paper" || s.platform.startsWith("paper-"),
    )
  )
    throw new Error("Only blog sources are supported");
  validateCompanySources(registry);
  validateSourceReplacements(registry);
  return registry;
}
export type Registry = Awaited<ReturnType<typeof loadRegistry>>;
