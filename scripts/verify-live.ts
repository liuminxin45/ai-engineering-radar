import { XMLValidator } from "fast-xml-parser";
const base = (
  process.env.LIVE_URL ?? "https://liuminxin45.github.io/ai-engineering-radar"
).replace(/\/$/, "");
for (const path of [
  "/",
  "/about/",
  "/data/articles.json",
  "/data/sources.json",
  "/data/health.json",
  "/data/advertorial-review.json",
  "/feed.xml",
  "/feed.atom",
]) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const text = await response.text();
  if (path.endsWith(".xml") || path.endsWith(".atom")) {
    if (XMLValidator.validate(text) !== true)
      throw new Error(`${path}: invalid XML`);
  }
  if (path.endsWith(".json")) JSON.parse(text);
  if (path === "/data/advertorial-review.json") {
    const report = JSON.parse(text);
    if (
      report.mode !== "label-only" ||
      report.suspectedCount !== report.articles.length
    )
      throw new Error("Live advertorial trial report is invalid");
    for (const article of report.articles)
      if (article.advertorial.status !== "suspected")
        throw new Error(
          "Live advertorial report contains an unflagged article",
        );
  }
  console.log(`${path}: OK`);
  if (path === "/data/articles.json") {
    const data = JSON.parse(text);
    if (!data.articles.length) throw new Error("Live article index is empty");
    if (
      data.articles.some(
        (a: { contentType?: string }) => a.contentType === "paper",
      )
    )
      throw new Error("Live index still contains papers");
    const r = await fetch(`${base}/articles/${data.articles[0].id}/`);
    if (!r.ok) throw new Error("Live article detail failed");
  }
}
