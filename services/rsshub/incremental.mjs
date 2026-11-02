// SPDX-License-Identifier: AGPL-3.0-only
import { load } from "cheerio";

// Selective adaptation of RSSHub lib/routes/csdn/blog.ts at 23f13e4.
// Its original handler requests every feed item's HTML. Keep the same reviewed
// URL and #content_views extraction, but use RSSHub's public ofetch API only for
// the specific article requested by Radar's persisted retry/new-item queue.
export function createIncrementalCsdn({ accounts, request, ofetch }) {
  const cache = new Map();
  let queue = Promise.resolve();
  function cached(key, fetcher) {
    const previous = cache.get(key);
    if (previous && previous.expires > Date.now()) return previous.promise;
    const promise = queue.catch(() => {}).then(fetcher);
    queue = promise;
    const entry = { promise, expires: Date.now() + 600_000 };
    cache.set(key, entry);
    // Failed bodies are never cached as success; a later run may retry them.
    promise.catch(() => {
      if (cache.get(key) === entry) cache.delete(key);
    });
    return promise;
  }
  return {
    index(account) {
      if (!accounts.has(account)) throw new Error("Unreviewed account");
      return cached(`index:${account}`, async () => {
        const feedUrl = `https://rss.csdn.net/${account}/rss/map`;
        const data = await request(`/rss/${encodeURIComponent(feedUrl)}`);
        if (data.error || !Array.isArray(data.item))
          throw new Error("RSSHub feed unavailable");
        // The generic feed route uses `description` for the RSS summary. Move
        // that field so it can never be mistaken for extracted article HTML.
        return {
          title: data.title,
          item: data.item.map(({ description, ...item }) => ({
            ...item,
            content: description || "",
          })),
        };
      });
    },
    body(account, id) {
      if (!accounts.has(account) || !/^[0-9]+$/.test(id))
        throw new Error("Unreviewed article");
      return cached(`body:${account}:${id}`, async () => {
        const link = `https://blog.csdn.net/${account}/article/details/${id}`;
        const html = await ofetch(link, {
          responseType: "text",
          timeout: 15_000,
          retry: 0,
          redirect: "error",
        });
        if (
          typeof html !== "string" ||
          Buffer.byteLength(html) > 8 * 1024 * 1024
        )
          throw new Error("Article response unavailable");
        const description = load(html)("#content_views").html();
        if (!description?.trim())
          throw new Error("CSDN body container unavailable");
        return {
          title: "CSDN article",
          item: [
            { title: "", link, creator: account, author: account, description },
          ],
        };
      });
    },
  };
}
