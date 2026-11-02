import * as cheerio from "cheerio";

// Publisher token arrays contain the original block Markdown in `raw`.
// Re-render that source rather than trusting the token objects as executable
// renderer extensions. A small set of media shortcodes has data-only adapters.
export function tokensToMarkdown(raw: string) {
  const tokens: unknown = JSON.parse(raw);
  if (!Array.isArray(tokens) || tokens.length > 20000)
    throw new Error("Invalid publisher token document");
  return tokens
    .map((token) => {
      if (!token || typeof token !== "object" || typeof token.type !== "string")
        throw new Error("Invalid publisher block token");
      if (token.type === "hr") return "\n\n---\n\n";
      if (typeof token.raw !== "string")
        throw new Error("Invalid publisher block token");
      const $ = cheerio.load("", {}, false);
      if (token.type === "hugoButton" && typeof token.href === "string")
        return (
          $("<p></p>")
            .append(
              $("<a></a>")
                .attr("href", token.href)
                .text(token.label || "原文链接"),
            )
            .toString() + "\n\n"
        );
      if (token.type === "hugoFigure" && typeof token.src === "string")
        return (
          $("<figure></figure>")
            .append(
              $("<img>").attr({
                src: token.src,
                alt: token.alt || token.caption || "",
              }),
            )
            .append(
              token.caption
                ? $("<figcaption></figcaption>").text(token.caption)
                : "",
            )
            .toString() + "\n\n"
        );
      return token.raw.replace(/\{\{[<%][\s\S]*?[>%]\}\}/g, "");
    })
    .join("");
}
