import type { Registry } from "./index.js";

// Explicit retirements: do not infer deletion from publication age.
export const sourceReplacements = [
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
    sourceId: "alibaba-csdn",
    companyId: "alibaba",
    replacementIds: ["aliyun-cloud-native"],
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
    replacementIds: ["ant-ling"],
  },
  {
    sourceId: "baidu-csdn",
    companyId: "baidu",
    replacementIds: ["baidu-cloud-csdn-candidate"],
  },
  {
    sourceId: "xiaomi-team-blog",
    companyId: "xiaomi",
    replacementIds: ["xiaomi-tech-site"],
  },
  {
    sourceId: "xiaomi",
    companyId: "xiaomi",
    replacementIds: ["xiaomi-tech-site"],
  },
  {
    sourceId: "xiaomi-juejin",
    companyId: "xiaomi",
    replacementIds: ["xiaomi-tech-site"],
  },
  {
    sourceId: "xiaomi-csdn-candidate",
    companyId: "xiaomi",
    replacementIds: ["xiaomi-tech-site"],
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
    sourceId: "alibaba",
    companyId: "alibaba",
    replacementIds: ["aliyun-cloud-native"],
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
    replacementIds: ["ant-ling"],
    referenceOnly: true,
  },
  {
    sourceId: "oppo",
    companyId: "oppo",
    replacementIds: ["oppo-segmentfault"],
    referenceOnly: true,
  },
  {
    sourceId: "jd",
    companyId: "jd",
    replacementIds: ["jd-cnblogs"],
    referenceOnly: true,
  },
  {
    sourceId: "ctrip",
    companyId: "ctrip",
    replacementIds: ["ctrip-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "xiaohongshu",
    companyId: "xiaohongshu",
    replacementIds: ["xiaohongshu-csdn"],
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
    replacementIds: ["ant-ling"],
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
    sourceId: "ctrip-cnblogs",
    companyId: "ctrip",
    replacementIds: ["ctrip-csdn"],
    referenceOnly: true,
  },
  {
    sourceId: "aliyun-dataphin",
    companyId: "alibaba",
    replacementIds: ["aliyun-cloud-native"],
  },
  {
    sourceId: "ant-oceanbase-csdn",
    companyId: "ant",
    replacementIds: ["ant-ling"],
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
