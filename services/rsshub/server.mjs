// SPDX-License-Identifier: AGPL-3.0-only
// RSSHub runs in its own process: its global request hooks must not affect Radar.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { init, request, ofetch } from "rsshub";
import { createIncrementalCsdn } from "./incremental.mjs";

const version = "1.0.0-master.23f13e4";
const registry = JSON.parse(
  await readFile(
    new URL("../../packages/source-registry/registry.json", import.meta.url),
    "utf8",
  ),
);
const accounts = new Set(
  registry.sources
    .filter(
      (s) =>
        s.platform === "csdn-feed" &&
        s.crawl.enabled &&
        s.verification.status === "verified",
    )
    .flatMap((s) => s.authorAllowlist ?? []),
);
await init({
  CACHE_TYPE: "memory",
  CACHE_EXPIRE: "600",
  CACHE_CONTENT_EXPIRE: "600",
  // Pin RSSHub's upstream default UA; random header generation can fail when
  // its browser-version dataset drifts. No custom site parser or browser layer.
  UA: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  REQUEST_TIMEOUT: "15000",
  REQUEST_RETRY: "1",
  PROXY_URI: process.env.RSSHUB_PROXY_URI || "",
  NO_LOGFILES: "true",
  // Only the internally constructed reviewed CSDN feed URLs use this feature.
  // The public wrapper does not expose RSSHub's arbitrary URL proxy route.
  ALLOW_USER_SUPPLY_UNSAFE_DOMAIN: "true",
});
const incremental = createIncrementalCsdn({ accounts, request, ofetch });

const cache = new Map();
let queue = Promise.resolve();
function feed(path) {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.promise;
  // Stock CSDN routes fetch an account's article pages in parallel. Serialize
  // accounts so one Radar backfill does not multiply that upstream fan-out.
  const promise = queue
    .catch(() => {})
    .then(async () => {
      const data = await request(path);
      if (data.error || !Array.isArray(data.item))
        throw new Error("RSSHub upstream feed unavailable");
      // Do not send the duplicate native `items` array across the HTTP boundary.
      return { title: data.title, item: data.item };
    });
  queue = promise;
  const entry = { promise, expires: Date.now() + 600_000 };
  cache.set(path, entry);
  promise.catch(() => {
    if (cache.get(path) === entry) cache.delete(path);
  });
  return promise;
}

const server = createServer(async (req, res) => {
  const reply = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  if (req.method !== "GET") return reply(405, { error: "GET required" });
  const url = new URL(req.url, "http://localhost");
  if (url.search)
    return reply(400, { error: "Query parameters are not supported" });
  if (url.pathname === "/healthz")
    return reply(200, { status: "ok", rsshub: version });
  if (url.pathname === "/source")
    return reply(200, {
      license: "AGPL-3.0-only",
      upstream: `https://github.com/DIYgod/RSSHub/tree/23f13e4`,
      service:
        "https://github.com/liuminxin45/ai-engineering-radar/tree/main/services/rsshub",
    });
  const route = url.pathname.match(
    /^\/csdn\/(blog|index|body)\/([A-Za-z0-9_]+)(?:\/([0-9]+))?$/,
  );
  const account = route?.[2];
  if (!account || !accounts.has(account))
    return reply(404, { error: "Route is not in the reviewed registry" });
  if ((route[1] === "body") !== !!route[3])
    return reply(404, { error: "Invalid article route" });
  try {
    const data =
      route[1] === "index"
        ? await incremental.index(account)
        : route[1] === "body"
          ? await incremental.body(account, route[3])
          : await feed(url.pathname);
    if (route[1] === "index") {
      const etag = `"${createHash("sha256").update(JSON.stringify(data)).digest("hex")}"`;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304);
        res.end();
        return;
      }
    }
    reply(200, data);
  } catch {
    // Upstream logs contain diagnostics; do not expose proxy URLs or credentials.
    reply(502, {
      error: "RSSHub upstream feed unavailable; inspect service logs",
    });
  }
});
const port = Number(process.env.RSSHUB_PORT || 1200);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid RSSHUB_PORT");
server.listen(port, "127.0.0.1", () =>
  console.log(`Radar RSSHub ${version} listening on 127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
