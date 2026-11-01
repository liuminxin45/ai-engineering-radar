import type { Registry } from "./index.js";

// Explicit retirements: do not infer deletion from publication age.
export const sourceReplacements = [
  {
    sourceId: "dewu-official",
    companyId: "dewu",
    replacementIds: ["dewu-csdn"],
  },
  {
    sourceId: "alibaba-csdn",
    companyId: "alibaba",
    replacementIds: ["aliyun-cloud-native", "aliyun-dataphin"],
  },
  {
    sourceId: "bytedance-csdn",
    companyId: "bytedance",
    replacementIds: ["bytedance-volcengine"],
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
] as const;

export function validateSourceReplacements(registry: Registry) {
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
