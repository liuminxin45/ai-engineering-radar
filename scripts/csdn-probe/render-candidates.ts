// Validation output only. This command never writes a production snapshot.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { articleParser } from "../../packages/article-parser/index.js";

const evidence = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
assert.notEqual(evidence, output);
assert(output.includes("work"));
const input = JSON.parse(
  await readFile(join(import.meta.dirname, "input.json"), "utf8"),
);
const readerCss = await readFile(
  join(import.meta.dirname, "../../apps/web/src/app/articles/[id]/reader.css"),
  "utf8",
);
const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const compact = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
type Row = {
  id: string;
  status?: string;
  parserStatus?: string;
  textCoverage?: number;
  exactText?: boolean;
  codeBlocks?: number;
  codeLayoutExact?: boolean;
  missingCodeBlocks?: number;
  images?: number;
  missingImages?: string[];
  sourceTables?: number;
  outputTables?: number;
  warnings?: string[];
};
const rows: Row[] = [];
await mkdir(output, { recursive: true });
for (const article of input.articles) {
  let source = "";
  try {
    source = await readFile(
      join(evidence, "articles", article.id, "source-body.html"),
      "utf8",
    );
  } catch {
    /* Actions artifacts use one directory per shard. */
  }
  for (const shard of await readdir(evidence)) {
    if (source) break;
    if (!shard.startsWith("shard-")) continue;
    try {
      source = await readFile(
        join(evidence, shard, "articles", article.id, "source-body.html"),
        "utf8",
      );
      break;
    } catch {
      /* Not all shards own this article. */
    }
  }
  if (!source) {
    rows.push({ id: article.id, status: "no_evidence" });
    continue;
  }
  const $ = cheerio.load(source);
  $(
    "script,style,.toc,.opt-box,.pre-numbering,.hide-preCode-box,.hljs-button,.hljs-ln-numbers,.code-tool-box",
  ).remove();
  // Some CSDN editors emit one sibling <code> per line. Keep every line.
  $("pre").each((_, pre) => {
    const lines = $(pre).children("code");
    if (lines.length > 1) {
      const text = lines
        .toArray()
        .map((line) => $(line).text().replaceAll("\u00a0", " "))
        .join("\n");
      $(pre).empty().append($("<code></code>").text(text));
    }
  });
  $("h1").each((_, h) => {
    if (compact($(h).text()) === compact(article.title)) $(h).remove();
  });
  const body = $("#content_views");
  const expectedText = compact(body.text());
  const expectedImages = new Set(
    body
      .find("img")
      .toArray()
      .map(
        (img) =>
          new URL(
            $(img).attr("data-src") || $(img).attr("src") || "",
            article.url,
          ).href,
      ),
  );
  const expectedCodeText = body
    .find("pre code")
    .toArray()
    .map((code) => $(code).text())
    .filter((text) => compact(text));
  const expectedCode = expectedCodeText.map(compact);
  const parsed = articleParser.parse({
    url: article.url,
    title: article.title,
    content: $.html(),
  });
  const dom = cheerio.load(parsed.html);
  const actualText = compact(dom.root().text());
  const textOnlyDom = cheerio.load(parsed.html);
  textOnlyDom(".heading-anchor").remove();
  const normalizeText = (text: string) =>
    text.normalize("NFC").replace(/\s+/gu, "");
  const fullTextEqual =
    normalizeText(body.text()) === normalizeText(textOnlyDom.root().text());
  const actualImages = new Set(
    dom("img")
      .toArray()
      .map((img) => dom(img).attr("src")),
  );
  const actualCode = compact(dom("pre code").text());
  const actualCodeText = dom("pre code")
    .toArray()
    .map((code) => dom(code).text())
    .filter((text) => compact(text));
  const missingCode = expectedCode.filter((code) => !actualCode.includes(code));
  const missingImages = [...expectedImages].filter(
    (url) => !actualImages.has(url),
  );
  const grams = Array.from(
    { length: Math.max(0, expectedText.length - 5) },
    (_, i) => expectedText.slice(i, i + 6),
  );
  const coverage = grams.length
    ? grams.filter((g) => actualText.includes(g)).length / grams.length
    : 1;
  assert.equal(dom("script,style,iframe,form,[onclick],[onerror]").length, 0);
  await writeFile(
    join(output, article.id + ".json"),
    JSON.stringify(
      {
        validationOnly: true,
        articleId: article.id,
        sourceSha256: createHash("sha256").update(source).digest("hex"),
        ...parsed,
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(output, article.id + ".html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(article.title)}</title><style>:root{--bg:#fff;--ink:#222;--muted:#666;--line:#e5e5e5;--mono:ui-monospace,monospace}*{box-sizing:border-box}body{margin:24px auto;padding:0 20px;max-width:800px;font-family:system-ui,sans-serif}h1{font-size:28px;line-height:1.5}a{color:inherit}${readerCss}</style><body class="radar-ui" data-preference="light"><p>正文抓取验证 · 本地候选，未发布</p><a href="${escapeHtml(article.url)}">阅读原文</a><h1>${escapeHtml(article.title)}</h1><article class="markdown-body">${parsed.html}</article></body></html>`,
  );
  const row = {
    id: article.id,
    parserStatus: parsed.status,
    textCoverage: coverage,
    exactText: fullTextEqual,
    codeBlocks: expectedCode.length,
    codeLayoutExact:
      JSON.stringify(expectedCodeText) === JSON.stringify(actualCodeText),
    missingCodeBlocks: missingCode.length,
    images: expectedImages.size,
    missingImages,
    sourceTables: body.find("table").length,
    outputTables: dom("table").length,
    warnings: parsed.warnings,
  };
  rows.push(row);
}
const report = {
  validationOnly: true,
  total: rows.length,
  parsed: rows.filter((r) => r.parserStatus).length,
  allTextPreserved: rows.filter((r) => r.exactText).length,
  codeComplete: rows.filter((r) => r.parserStatus && r.missingCodeBlocks === 0)
    .length,
  codeLayoutExact: rows.filter((r) => r.codeLayoutExact).length,
  imagesComplete: rows.filter((r) => r.parserStatus && !r.missingImages?.length)
    .length,
  tablesComplete: rows.filter(
    (r) => r.parserStatus && r.sourceTables === r.outputTables,
  ).length,
  rows,
};
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    ...report,
    rows: rows.filter(
      (r) =>
        !r.exactText ||
        r.missingCodeBlocks ||
        r.missingImages?.length ||
        r.sourceTables !== r.outputTables,
    ),
  }),
);
