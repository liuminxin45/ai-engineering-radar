import { sourceSchema } from "../../packages/shared/types.js";

// Historical parser fixture; this account is not registered or collected.
export const aliyunFixture = sourceSchema.parse({
  id: "aliyun-cloud-native",
  publisherId: "aliyun-cloud-native",
  name: "阿里云云原生 · 账号主页",
  entryUrl: "https://developer.aliyun.com/profile/pawmkwdq37c7s",
  url: "https://developer.aliyun.com/profile/pawmkwdq37c7s",
  priority: "A",
  adapter: "html",
  platform: "aliyun-profile",
  verification: {
    status: "verified",
    evidenceUrls: ["https://developer.aliyun.com/profile/pawmkwdq37c7s"],
    note: "用户指定的阿里云云原生账号主页，稳定 profile ID pawmkwdq37c7s。仅采集该账号动态中的“发表了文章”记录，排除点赞、评论和第三方文章，按原始发布时间建立索引。沿用原来源与发布主体 ID，保留已有文章 ID。",
    reviewedAt: "2026-11-02T03:37:09.013Z",
  },
  crawl: {
    enabled: true,
    intervalMinutes: 1440,
    maxItems: 50,
    backfillLimit: 100,
  },
  authorAllowlist: ["pawmkwdq37c7s"],
  linkHosts: ["developer.aliyun.com"],
  linkPattern: "^/article/[0-9]+/?$",
});
