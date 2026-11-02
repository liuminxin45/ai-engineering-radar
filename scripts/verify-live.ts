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
    const papers = data.articles.filter(
      (a: { contentType?: string }) => a.contentType === "paper",
    );
    if (!papers.length) throw new Error("Live paper index is empty");
    if (
      new Set(papers.map((a: { canonicalUrl: string }) => a.canonicalUrl))
        .size !== papers.length
    )
      throw new Error("Duplicate live paper identities");
    for (const paper of papers) {
      if (
        !paper.companyIds?.length ||
        !paper.paperAffiliations?.length ||
        paper.companyIds.some(
          (id: string) =>
            !paper.paperAffiliations.some(
              (p: { companyId: string }) => p.companyId === id,
            ),
        )
      )
        throw new Error(`Unverified live paper affiliation: ${paper.id}`);
    }
    console.log(`Verified ${papers.length} live papers with company evidence`);
    const r = await fetch(`${base}/articles/${data.articles[0].id}/`);
    if (!r.ok) throw new Error("Live article detail failed");
  }
}
