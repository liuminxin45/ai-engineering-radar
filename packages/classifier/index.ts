import type { Candidate, Classification } from "../shared/types.js";

export const INDEX_VERSION = "source-index-1";

/** Account verification and metadata validation happen before this indexing step. */
export function indexOfficialArticle(
  _item: Pick<Candidate, "title">,
): Classification {
  return {
    status: "accepted",
    topics: [],
    reason:
      "收录自已核验的国内官方技术账号；首批不进行文章内容筛选或自动主题分类。",
    evidence: [],
    method: "source",
    version: INDEX_VERSION,
    classifiedAt: new Date().toISOString(),
  };
}
