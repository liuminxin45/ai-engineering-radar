import type { Registry } from "./index.js";

// Explicit retirements: do not infer deletion from publication age.
export const sourceReplacements = [
  {
    sourceId: "ant-ling",
    companyId: "ant",
    replacementIds: ["ant-data-csdn"],
  },
  {
    sourceId: "dewu-official",
    companyId: "dewu",
    replacementIds: ["dewu-tencent"],
  },
  {
    sourceId: "dewu-csdn",
    companyId: "dewu",
    replacementIds: ["dewu-tencent"],
  },
  {
    sourceId: "bytedance-csdn",
    companyId: "bytedance",
    replacementIds: ["bytedance-tech-volcengine"],
  },
  {
    sourceId: "tencent-csdn",
    companyId: "tencent",
    replacementIds: ["tencent-qqnews"],
  },
  {
    sourceId: "netease-cnblogs",
    companyId: "netease",
    replacementIds: ["netease-csdn"],
  },
  {
    sourceId: "kuaishou-segmentfault",
    companyId: "kuaishou",
    replacementIds: ["kuaishou-csdn"],
  },
  {
    sourceId: "ant-segmentfault",
    companyId: "ant",
    replacementIds: ["ant-data-csdn"],
  },
  {
    sourceId: "baidu-csdn",
    companyId: "baidu",
    replacementIds: ["baidu-cloud-csdn-candidate"],
  },
  {
    sourceId: "vivo-site",
    companyId: "vivo",
    replacementIds: ["vivo-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "tencent",
    companyId: "tencent",
    replacementIds: ["tencent-qqnews"],
    referenceOnly: true,
  },
  {
    sourceId: "bytedance",
    companyId: "bytedance",
    replacementIds: ["bytedance-tech-volcengine"],
    referenceOnly: true,
  },
  {
    sourceId: "baidu",
    companyId: "baidu",
    replacementIds: ["baidu-cloud-csdn-candidate"],
    referenceOnly: true,
  },
  {
    sourceId: "huawei",
    companyId: "huawei",
    replacementIds: ["huawei-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "kuaishou",
    companyId: "kuaishou",
    replacementIds: ["kuaishou-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "ant",
    companyId: "ant",
    replacementIds: ["ant-data-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "jd",
    companyId: "jd",
    replacementIds: ["jd-cnblogs"],
    referenceOnly: true,
  },
  {
    sourceId: "netease",
    companyId: "netease",
    replacementIds: ["netease-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "bilibili",
    companyId: "bilibili",
    replacementIds: ["bilibili-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "ant-csdn",
    companyId: "ant",
    replacementIds: ["ant-data-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "tencent-cloud-official",
    companyId: "tencent",
    replacementIds: ["tencent-qqnews"],
    referenceOnly: true,
  },
  {
    sourceId: "vivo-cnblogs",
    companyId: "vivo",
    replacementIds: ["vivo-csdn"],
  },
  {
    sourceId: "ant-oceanbase-csdn",
    companyId: "ant",
    replacementIds: ["ant-data-csdn"],
  },
  {
    sourceId: "kuaishou-infoq",
    companyId: "kuaishou",
    replacementIds: ["kuaishou-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "bytedance-volcengine",
    companyId: "bytedance",
    replacementIds: ["bytedance-tech-volcengine"],
  },
] as const;

// Explicit removals requested by the maintainer; these have no replacement.
export const sourceWithdrawals = [
  { sourceId: "xiaomi-tech-site", companyId: "xiaomi" },
  { sourceId: "xiaomi-papers-crossref", companyId: "xiaomi" },
  { sourceId: "mimo-hf-papers", companyId: "xiaomi" },
  { sourceId: "xiaomi-team-blog", companyId: "xiaomi" },
  { sourceId: "xiaomi", companyId: "xiaomi" },
  { sourceId: "xiaomi-juejin", companyId: "xiaomi" },
  { sourceId: "xiaomi-csdn-candidate", companyId: "xiaomi" },
  { sourceId: "xiaohongshu-papers-crossref", companyId: "xiaohongshu" },
  { sourceId: "ctrip-csdn", companyId: "ctrip", sourceOnly: true },
  { sourceId: "xiaohongshu-csdn", companyId: "xiaohongshu" },
  { sourceId: "aliyun-cloud-native", companyId: "alibaba", sourceOnly: true },
  { sourceId: "qwen-hf-papers", companyId: "alibaba", sourceOnly: true },
  { sourceId: "kling-hf-papers", companyId: "kuaishou", sourceOnly: true },
  { sourceId: "joyai-readme-papers", companyId: "jd", sourceOnly: true },
  { sourceId: "index-readme-papers", companyId: "bilibili", sourceOnly: true },
  { sourceId: "alibaba-csdn", companyId: "alibaba", sourceOnly: true },
  { sourceId: "alibaba", companyId: "alibaba", sourceOnly: true },
  { sourceId: "ctrip", companyId: "ctrip", sourceOnly: true },
  { sourceId: "xiaohongshu", companyId: "xiaohongshu" },
  { sourceId: "ctrip-cnblogs", companyId: "ctrip", sourceOnly: true },
  { sourceId: "aliyun-dataphin", companyId: "alibaba", sourceOnly: true },
  { sourceId: "oppo", companyId: "oppo" },
  { sourceId: "oppo-segmentfault", companyId: "oppo" },
] as const;

export function validateSourceReplacements(registry: Registry) {
  for (const rule of sourceWithdrawals) {
    if (
      (!("sourceOnly" in rule && rule.sourceOnly) &&
        registry.companies.some((c) => c.id === rule.companyId)) ||
      registry.sources.some((s) => s.id === rule.sourceId)
    )
      throw new Error(
        `Withdrawn company or source still registered: ${rule.sourceId}`,
      );
  }
  for (const rule of sourceReplacements) {
    if (registry.sources.some((s) => s.id === rule.sourceId))
      throw new Error(`Retired source still registered: ${rule.sourceId}`);
    for (const id of rule.replacementIds) {
      const source = registry.sources.find((s) => s.id === id);
      const publisher = registry.publishers.find(
        (p) => p.id === source?.publisherId,
      );
      if (!source || publisher?.companyId !== rule.companyId)
        throw new Error(`Replacement must exist in the same company: ${id}`);
    }
  }
}
