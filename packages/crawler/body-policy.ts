import { ENGINE_VERSION } from "../article-parser/index.js";
import type { ArticleBody } from "../shared/article-body.js";

// Reader v2 changes completeness labels only; stored sanitized HTML is valid.
// Upgrade before queue selection to avoid refreshing successful v1 bodies.
export function upgradeBodyPolicy(bodies: ArticleBody[]): ArticleBody[] {
  return bodies.map((body) => {
    if (body.engineVersion !== "radar-reader-1") return body;
    const warnings = body.warnings.filter(
      (warning) => warning !== "取得的正文较短，可能不完整。",
    );
    const removedShortWarning = warnings.length !== body.warnings.length;
    return {
      ...body,
      engineVersion: ENGINE_VERSION,
      warnings,
      status:
        body.status === "partial" && removedShortWarning && !warnings.length
          ? "ready"
          : body.status,
    };
  });
}
