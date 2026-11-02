import { ENGINE_VERSION } from "../article-parser/index.js";
import type { ArticleBody } from "../shared/article-body.js";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { normalizeCsdnCode } from "../article-parser/csdn.js";

// Reader v2 changes completeness labels only; stored sanitized HTML is valid.
// Upgrade before queue selection to avoid refreshing successful v1 bodies.
export function upgradeBodyPolicy(bodies: ArticleBody[]): ArticleBody[] {
  return bodies.map((original) => {
    let body = original;
    if (body.engineVersion === "radar-reader-1") {
      const warnings = body.warnings.filter(
        (warning) => warning !== "取得的正文较短，可能不完整。",
      );
      const removedShortWarning = warnings.length !== body.warnings.length;
      body = {
        ...body,
        engineVersion: ENGINE_VERSION,
        warnings,
        status:
          body.status === "partial" && removedShortWarning && !warnings.length
            ? "ready"
            : body.status,
      };
    }
    if (
      body.html &&
      body.ruleId === "csdn" &&
      body.ruleVersion === "2" &&
      ["blog.csdn.net", "devpress.csdn.net"].includes(
        new URL(body.sourceUrl).hostname,
      )
    ) {
      const $ = load(body.html, {}, false);
      const emptyCode = $("pre")
        .toArray()
        .some((pre) => !$(pre).text().trim());
      // Already-sanitized HTML stays sanitized: this transform only replaces
      // code markup with escaped text. Do not re-enrich headings or fake new
      // capture timestamps. Empty legacy blocks need a fresh source document.
      normalizeCsdnCode($);
      const html = $.root().html() || "";
      const textLength = $.root().text().replace(/\s+/g, " ").trim().length;
      body = {
        ...body,
        html,
        textLength,
        readingMinutes: Math.max(1, Math.ceil(textLength / 450)),
        contentHash: createHash("sha256").update(html).digest("hex"),
        ruleVersion: "3",
        ...(emptyCode ? { refreshPending: true } : {}),
      };
    }
    return body;
  });
}
