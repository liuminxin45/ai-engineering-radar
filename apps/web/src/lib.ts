import raw from "./generated/site.json";
import type {
  Article,
  Company,
  Publisher,
  Source,
  SourceState,
} from "../../../packages/shared/types";
export const site = raw as unknown as {
  schemaVersion: number;
  generatedAt: string;
  articles: Article[];
  companies: Company[];
  publishers: Publisher[];
  topics: Array<{ id: string; name: string }>;
  sources: Array<Source & { state: SourceState }>;
  health: {
    articleCount: number;
    sourceCount: number;
    enabledSources: number;
    successfulSources: number;
    failedSources: number;
    lastSuccessAt: string | null;
  };
};
export const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
  /\/$/,
  "",
);
export const asset = (path: string) => `${base}${path}`;
export const companyName = (id: string) =>
  site.companies.find((c) => c.id === id)?.name ?? id;
export const topicName = (id: string) =>
  site.topics.find((t) => t.id === id)?.name ?? id;
export const dateLabel = (a: Article) =>
  (a.publishedAt ?? a.discoveredAt).slice(0, 10);
export const statusNames: Record<string, string> = {
  verified: "已核验",
  pending: "待核验",
  rejected: "不收录",
  suspended: "暂停新增",
  new: "尚未检测",
  success: "采集成功",
  "not-modified": "无更新",
  failed: "采集失败",
  blocked: "访问受限",
  reference: "身份参考",
};
