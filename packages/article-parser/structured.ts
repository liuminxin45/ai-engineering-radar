import * as cheerio from "cheerio";
import { parseExpressionAt } from "acorn";
import type { ParseInput } from "./types.js";

export interface StructuredExtractor {
  id: string;
  version: string;
  hosts: readonly string[];
  extract(input: ParseInput): ParseInput | undefined;
}

const tencent: StructuredExtractor = {
  id: "tencent-article-json",
  version: "1",
  hosts: ["developer.cloud.tencent.com", "cloud.tencent.com"],
  extract(input) {
    const $ = cheerio.load(input.content);
    const raw = $("#__NEXT_DATA__").text();
    if (!raw) return;
    const data = JSON.parse(raw);
    const id = new URL(input.url).pathname.split("/").filter(Boolean).at(-1);
    for (const [key, value] of Object.entries(
      data?.props?.pageProps?.fallback || {},
    )) {
      if (
        !key.includes("/api/article/detail") ||
        !key.includes(`articleId:${id}`)
      )
        continue;
      const info = (
        value as {
          articleInfo?: {
            articleId?: number;
            content?: unknown;
            title?: string;
          };
        }
      )?.articleInfo;
      if (
        String(info?.articleId) !== id ||
        typeof info?.content !== "string" ||
        !info.content.trim()
      )
        continue;
      return {
        ...input,
        content: info.content,
        title: input.title || info.title,
        format: /^\s*<(?:div|article|p|section|h[1-6])\b/i.test(info.content)
          ? "html"
          : "markdown",
        fragment: true,
        ruleId: this.id,
      };
    }
  },
};

const aliyun: StructuredExtractor = {
  id: "aliyun-lake",
  version: "2",
  hosts: ["developer.aliyun.com"],
  extract(input) {
    const $ = cheerio.load(input.content);
    for (const script of $("script:not([src])").toArray()) {
      const text = $(script).text();
      const match = /GLOBAL_CONFIG\.larkContent\s*=\s*(?=['"])/.exec(text);
      if (!match) continue;
      // Parse a string literal, never execute the publisher's JavaScript.
      const expression = parseExpressionAt(
        text,
        match.index + match[0].length,
        { ecmaVersion: "latest" },
      );
      if (
        expression.type !== "Literal" ||
        typeof expression.value !== "string" ||
        !expression.value.trim()
      )
        continue;
      const lake = cheerio.load(expression.value, {}, false);
      for (let pass = 0; pass < 5 && lake("card").length; pass++)
        lake("card").each((_, element) => {
          const node = lake(element);
          if (node.attr("name") === "hr") {
            node.replaceWith(lake("<hr>"));
            return;
          }
          try {
            const data = JSON.parse(
              decodeURIComponent(
                (node.attr("value") || "").replace(/^data:/, ""),
              ),
            );
            if (node.attr("name") === "image" && typeof data.src === "string")
              node.replaceWith(
                lake("<figure></figure>").append(
                  lake("<img>").attr({
                    src: data.src,
                    alt: data.alt || data.title || "",
                  }),
                ),
              );
            else if (
              node.attr("name") === "table" &&
              typeof data.html === "string"
            )
              node.replaceWith(lake("<div></div>").html(data.html));
            else if (
              /code/.test(node.attr("name") || "") &&
              typeof data.code === "string"
            )
              node.replaceWith(
                lake("<pre></pre>").append(
                  lake("<code></code>").text(data.code),
                ),
              );
            else if (typeof data.url === "string")
              node.replaceWith(
                lake("<p></p>").append(
                  lake("<a></a>")
                    .attr("href", data.url)
                    .text(data.title || "原文附件"),
                ),
              );
            else node.replaceWith(lake("<p></p>").text("嵌入内容请阅读原文。"));
          } catch {
            node.replaceWith(lake("<p></p>").text("嵌入内容请阅读原文。"));
          }
        });
      lake("card").replaceWith("<p>嵌入内容请阅读原文。</p>");
      return {
        ...input,
        content: lake.root().html() || "",
        fragment: true,
        format: "html",
        ruleId: this.id,
      };
    }
  },
};

export const structuredExtractors: StructuredExtractor[] = [tencent, aliyun];
