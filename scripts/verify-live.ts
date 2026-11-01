import { XMLValidator } from "fast-xml-parser";
const base = (
  process.env.LIVE_URL ?? "https://liuminxin45.github.io/ai-engineering-radar"
).replace(/\/$/, "");
for (const path of [
  "/",
  "/sources/",
  "/data/articles.json",
  "/data/sources.json",
  "/data/health.json",
  "/feed.xml",
  "/feed.atom",
  "/feed/company/meituan.xml",
  "/feed/topic/agent.atom",
]) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const text = await response.text();
  if (path.endsWith(".xml") || path.endsWith(".atom")) {
    if (XMLValidator.validate(text) !== true)
      throw new Error(`${path}: invalid XML`);
  }
  if (path.endsWith(".json")) JSON.parse(text);
  console.log(`${path}: OK`);
  if (path === "/data/articles.json") {
    const data = JSON.parse(text);
    if (!data.articles.length) throw new Error("Live article index is empty");
    const r = await fetch(`${base}/articles/${data.articles[0].id}/`);
    if (!r.ok) throw new Error("Live article detail failed");
  }
}
