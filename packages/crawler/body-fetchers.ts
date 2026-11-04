import { XMLParser } from "fast-xml-parser";
import {
  articleParser,
  type ParseInput,
  type ParsedArticle,
} from "../article-parser/index.js";
import type { AcquisitionTrace } from "../shared/acquisition.js";
import type { Article, Source } from "../shared/types.js";
import { fetchReviewed } from "./http.js";
import { normalizeUrl } from "./deduplicate.js";
import { createCsdnBodyLoader } from "./platforms/csdn-body.js";
import {
  verifyToutiaoDocument,
  reviewedToutiaoUrl,
} from "./platforms/toutiao.js";
import { createBrowserDocumentClient } from "./acquisition/browser.js";
import { acquireWithFallback } from "./acquisition/chain.js";
import {
  QWEN_CURRENT,
  QWEN_LEGACY,
  validateQwenSource,
} from "./platforms/qwen.js";

const array = (value: any): any[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const string = (value: any): string =>
  typeof value === "string" ? value : value?.["#text"] || "";

// A loader is scoped to one collection run. Feed/API requests are shared across
// articles; no response bytes or executable source pages are persisted.
export function createBodyLoader(): (
  article: Article,
  source: Source,
  url: string,
) => Promise<ParsedArticle & { acquisition?: AcquisitionTrace }> {
  const csdn = createCsdnBodyLoader();
  const browser = createBrowserDocumentClient();
  const feeds = new Map<string, Promise<Map<string, string>>>();
  const qwen = new Map<string, Promise<Map<string, string>>>();
  const archivedQwen = new Map<string, Promise<any[]>>();
  async function feed(source: Source) {
    if (!feeds.has(source.id))
      feeds.set(
        source.id,
        (async () => {
          const response = await fetchReviewed(source.url, source);
          const data = new XMLParser({
            ignoreAttributes: false,
            processEntities: false,
          }).parse(response.text);
          const result = new Map<string, string>();
          for (const item of array(
            data.rss?.channel?.item || data.feed?.entry,
          )) {
            const link =
              typeof item.link === "string"
                ? item.link
                : array(item.link).find(
                    (link) => !link["@_rel"] || link["@_rel"] === "alternate",
                  )?.["@_href"];
            const content = string(item["content:encoded"] || item.content);
            const author = string(item.author || item["dc:creator"]);
            if (
              source.authorAllowlist?.length &&
              !source.authorAllowlist.includes(author)
            )
              continue;
            if (link && content)
              result.set(normalizeUrl(new URL(link, source.url).href), content);
          }
          return result;
        })(),
      );
    return feeds.get(source.id)!;
  }
  return async (article: Article, source: Source, url: string) => {
    if (source.platform === "csdn-feed") return csdn(article, source, url);
    if (source.platform === "toutiao-account") {
      const target = reviewedToutiaoUrl(source, url);
      if (!browser)
        throw new Error("Toutiao requires the browser acquisition service");
      return acquireWithFallback(
        [{ id: "camoufox", fetch: () => browser(source, target) }],
        (document) => {
          verifyToutiaoDocument(document.content, source);
          const parsed = articleParser.parse(document);
          if (
            parsed.title.normalize("NFKC").trim() !==
            article.title.normalize("NFKC").trim()
          )
            throw new Error(
              "Toutiao title does not match the collected article",
            );
          return parsed;
        },
      );
    }
    let input: ParseInput = { url, title: article.title, content: "" };
    if (source.platform === "qwen-research") {
      validateQwenSource(source);
      if (!qwen.has(source.id))
        qwen.set(
          source.id,
          (async () => {
            const response = await fetchReviewed(QWEN_CURRENT, source);
            const data = JSON.parse(response.text);
            if (data.success !== true || !Array.isArray(data.data?.articles))
              throw new Error("Qwen article response unavailable");
            return new Map<string, string>(
              data.data.articles
                .filter(
                  (item: any) =>
                    item.type === "qwen_ai" &&
                    item.language === "en-US" &&
                    item.extra?.author === "QwenTeam" &&
                    item.extra?.draft !== true &&
                    typeof item.content === "string",
                )
                .map((item: any) => [item.path, item.content]),
            );
          })(),
        );
      const content = (await qwen.get(source.id)!).get(
        new URL(url).searchParams.get("id") || "",
      );
      if (content) input.content = content;
      else {
        if (!archivedQwen.has(source.id))
          archivedQwen.set(
            source.id,
            fetchReviewed(QWEN_LEGACY, source).then((response) => {
              const data = JSON.parse(response.text);
              if (!Array.isArray(data))
                throw new Error("Qwen archive response unavailable");
              return data;
            }),
          );
        const id = new URL(url).searchParams.get("id");
        const record = (await archivedQwen.get(source.id)!).find(
          (record) =>
            record.id === id &&
            record.author === "QwenTeam" &&
            record.draft !== true,
        );
        const resource = record?.htmlLink || record?.tokenLinks;
        if (typeof resource === "string") {
          const target = new URL(resource);
          if (
            target.protocol !== "https:" ||
            !(source.bodyHosts ?? []).includes(target.hostname) ||
            !target.pathname.startsWith("/research/")
          )
            throw new Error("Qwen document is outside reviewed body hosts");
          const response = await fetchReviewed(target.href, {
            ...source,
            linkHosts: source.bodyHosts,
          });
          input = {
            ...input,
            url: response.url,
            content: response.text,
            ...(record.htmlLink
              ? {}
              : {
                  format: "markdown-tokens",
                  fragment: true,
                  ruleId: "qwen-publisher-tokens",
                }),
          };
        }
      }
    }
    if (!input.content && source.adapter === "feed") {
      // A missing full-text field falls back to the article page, never summary.
      const content = await feed(source)
        .then((items) => items.get(normalizeUrl(url)))
        .catch(() => undefined);
      if (content)
        input = { ...input, content, fragment: true, ruleId: "publisher-feed" };
    }
    if (!input.content) input.content = (await fetchReviewed(url, source)).text;
    return articleParser.parse(input);
  };
}
