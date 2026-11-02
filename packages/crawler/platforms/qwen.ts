import type { Candidate, Source } from "../../shared/types.js";
import { CrawlError, fetchReviewed, type HttpResult } from "../http.js";

const ORIGIN = "https://qwen.ai";
export const QWEN_CURRENT = `${ORIGIN}/api/v2/article/retrieval?type=qwen_ai&language=en-US`;
export const QWEN_LEGACY = `${ORIGIN}/api/page_config?code=research.research-list&language=en`;
// The site's research frontend explicitly includes these archived IDs. Its legacy
// API also exposes records outside Research; new publications use the v2 feed.
const archivedResearchIds = new Set([
  "agent",
  "chinese-clip",
  "codeqwen1.5",
  "global-load-balance",
  "gspo",
  "ofa",
  "ofasys",
  "qvq-72b-preview",
  "qvq-max-preview",
  "qwen",
  "qwen-agent-2405",
  "qwen-image",
  "qwen-image-edit",
  "qwen-image-edit-2509",
  "qwen-max-0428",
  "qwen-moe",
  "qwen-mt",
  "qwen-tts",
  "qwen-vl",
  "qwen-vlo",
  "qwen1.5",
  "qwen1.5-110b",
  "qwen1.5-32b",
  "qwen2",
  "qwen2-audio",
  "qwen2-math",
  "qwen2-vl",
  "qwen2.5",
  "qwen2.5-1m",
  "qwen2.5-coder",
  "qwen2.5-coder-family",
  "qwen2.5-llm",
  "qwen2.5-math",
  "qwen2.5-math-prm",
  "qwen2.5-max",
  "qwen2.5-omni",
  "qwen2.5-turbo",
  "qwen2.5-vl",
  "qwen2.5-vl-32b",
  "qwen3",
  "qwen3-asr-flash",
  "qwen3-coder",
  "qwen3-embedding",
  "qwen3-livetranslate",
  "qwen3-max",
  "qwen3-next",
  "qwen3-omni",
  "qwen3-tts",
  "qwen3-vl",
  "qwen3guard",
  "qwq-32b",
  "qwq-32b-preview",
  "qwq-max-preview",
]);

export function validateQwenSource(source: Source) {
  if (
    source.adapter !== "html" ||
    source.url !== `${ORIGIN}/research` ||
    source.entryUrl !== source.url ||
    source.authorAllowlist?.length !== 1 ||
    source.authorAllowlist[0] !== "QwenTeam" ||
    source.linkHosts?.length
  )
    throw new CrawlError(
      "Qwen requires the reviewed official research directory",
      undefined,
      true,
    );
}

function timestamp(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return;
  const day = value.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00Z`);
  const date = new Date(value);
  if (
    !Number.isFinite(+calendar) ||
    calendar.toISOString().slice(0, 10) !== day ||
    !Number.isFinite(+date) ||
    +date > Date.now() + 86400000 ||
    date.getUTCFullYear() < 1990
  )
    return;
  return date.toISOString();
}

export function parseQwenResearch(
  current: string,
  legacy: string,
): Candidate[] {
  let latest: any, archived: any;
  try {
    latest = JSON.parse(current);
    archived = JSON.parse(legacy);
  } catch {
    throw new CrawlError("Qwen research response is not valid JSON");
  }
  if (
    latest?.success !== true ||
    !Array.isArray(latest.data?.articles) ||
    !Array.isArray(archived)
  )
    throw new CrawlError("Qwen research listing unavailable");
  const items = new Map<string, Candidate>();
  const add = (id: unknown, title: unknown, meta: any) => {
    if (
      typeof id !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,149}$/.test(id) ||
      typeof title !== "string" ||
      !title.trim() ||
      !meta ||
      meta.draft === true ||
      meta.author !== "QwenTeam"
    )
      return;
    items.set(id, {
      externalId: id,
      title: title.replace(/\s+/g, " ").trim().slice(0, 600),
      url: `${ORIGIN}/blog?id=${encodeURIComponent(id)}`,
      author: "QwenTeam",
      // Introduction may contain body excerpts, HTML and internal repository URLs.
      // Persist neither those excerpts nor the content/extra blobs.
      publishedAt: timestamp(meta.date),
      language: "en",
    });
  };
  for (const item of archived) {
    if (item && archivedResearchIds.has(item.id))
      add(item.id, item.title, item);
  }
  for (const item of latest.data.articles) {
    if (item?.type === "qwen_ai" && item.language === "en-US")
      add(item.path, item.title, item.extra);
  }
  return [...items.values()].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
}

export async function collectQwen(
  source: Source,
  response: HttpResult,
  limit: number,
) {
  validateQwenSource(source);
  const current = await fetchReviewed(QWEN_CURRENT, source);
  const legacy = await fetchReviewed(QWEN_LEGACY, source);
  const items = parseQwenResearch(current.text, legacy.text).slice(0, limit);
  if (!items.length) throw new CrawlError("No Qwen research entries parsed");
  // The HTML shell validators do not cover either JSON endpoint.
  return {
    items,
    response: { ...response, etag: undefined, lastModified: undefined },
    warnings: [],
  };
}
