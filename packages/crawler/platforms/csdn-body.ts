import type { Article, Source } from "../../shared/types.js";
import { articleParser } from "../../article-parser/index.js";
import { acquireWithFallback } from "../acquisition/chain.js";
import type { DocumentProvider } from "../acquisition/types.js";
import { createBrowserDocumentClient } from "../acquisition/browser.js";
import { createRssHubClient } from "../rsshub.js";
import { fetchReviewed } from "../http.js";
import { reviewedCsdnUrl } from "./csdn.js";

export function createCsdnBodyLoader(
  options: {
    rssHub?: Pick<NonNullable<ReturnType<typeof createRssHubClient>>, "body">;
    browser?: ReturnType<typeof createBrowserDocumentClient>;
    http?: typeof fetchReviewed;
  } = {},
) {
  const rssHub = options.rssHub ?? createRssHubClient();
  const browser = options.browser ?? createBrowserDocumentClient();
  const http = options.http ?? fetchReviewed;
  return async (article: Article, source: Source, value: string) => {
    const url = reviewedCsdnUrl(source, value);
    const providers: DocumentProvider[] = [
      {
        id: rssHub ? "rsshub-http" : "reviewed-http",
        fetch: async () =>
          rssHub
            ? {
                url,
                title: article.title,
                content: `<div id="content_views">${await rssHub.body(source, url)}</div>`,
              }
            : { url, content: (await http(url, source)).text },
      },
    ];
    if (browser)
      providers.push({ id: "camoufox", fetch: () => browser(source, url) });
    return acquireWithFallback(providers, (document) => {
      const parsed = articleParser.parse(document);
      const normalize = (text: string) =>
        text
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "");
      if (normalize(parsed.title) !== normalize(article.title))
        throw new Error("CSDN title does not match the collected article");
      return parsed;
    });
  };
}
