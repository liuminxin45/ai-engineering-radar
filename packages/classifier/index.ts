import type { Candidate, Classification } from "../shared/types.js";

export const INDEX_VERSION = "source-index-1";

/** Account verification and metadata validation happen before this indexing step. */
export function indexOfficialArticle(
  item: Pick<Candidate, "title" | "contentType">,
): Classification {
  return {
    status: "accepted",
    topics: [],
    reason:
      item.contentType === "paper"
        ? "论文来源和公司归属已核验，保留作者机构署名或官方研究目录证据。"
        : "收录自已核验的国内官方技术账号；首批不进行文章内容筛选或自动主题分类。",
    evidence: [],
    method: "source",
    version: INDEX_VERSION,
    classifiedAt: new Date().toISOString(),
  };
}
