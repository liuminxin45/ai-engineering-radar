import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("apps/web/out");
const base = process.env.BASE_PATH ?? "/ai-engineering-radar";
const port = Number(process.env.RADAR_TEST_PORT ?? 4173);
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/rss+xml; charset=utf-8",
  ".atom": "application/atom+xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://localhost");
    if (!url.pathname.startsWith(base + "/") && url.pathname !== base) {
      res.writeHead(404).end("Not found");
      return;
    }
    const decoded = decodeURIComponent(url.pathname.slice(base.length));
    let file = resolve(root, "." + decoded);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const body = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () =>
  console.log(`Serving static export on http://localhost:${port}${base}/`),
);
