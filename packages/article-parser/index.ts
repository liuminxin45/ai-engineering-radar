import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { Readability } from "@mozilla/readability";
import { marked } from "marked";
import ruleFile from "./rules.json" with { type: "json" };
import {
  parserRuleSchema,
  type ParseInput,
  type ParsedArticle,
  type ParserRule,
} from "./types.js";
import {
  structuredExtractors,
  type StructuredExtractor,
} from "./structured.js";
import { tokensToMarkdown } from "./tokens.js";

export const ENGINE_VERSION = "radar-reader-2";
export { parserRuleSchema } from "./types.js";
export type { ParseInput, ParsedArticle, ParserRule } from "./types.js";
export type { StructuredExtractor } from "./structured.js";
export const parserRules = ruleFile.rules.map((rule) =>
  parserRuleSchema.parse(rule),
);
const purifierWindow = new JSDOM("").window;
const purifier = createDOMPurify(purifierWindow);
const tags =
  "p div section article span h2 h3 h4 h5 h6 strong b em i u s del br hr blockquote pre code ul ol li table thead tbody tfoot tr th td caption figure figcaption img a sup sub dl dt dd details summary kbd samp mark".split(
    " ",
  );
const attributes = [
  "id",
  "href",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "colspan",
  "rowspan",
  "start",
  "class",
  "loading",
  "decoding",
  "referrerpolicy",
  "target",
  "rel",
  "role",
  "tabindex",
  "aria-label",
];
const normalizedText = (value: string) => value.replace(/\s+/g, " ").trim();

function safeUrl(value: string | undefined, base: string, image = false) {
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return;
  if (!image && value.startsWith("#")) return value;
  try {
    const url = new URL(value, base);
    if (
      !(
        ["https:", "http:"].includes(url.protocol) ||
        (!image && url.protocol === "mailto:")
      )
    )
      return;
    if (url.username || url.password) return;
    const host = url.hostname.toLowerCase();
    if (/^\d+(\.\d+){3}$/.test(host)) {
      const [first, second] = host.split(".").map(Number);
      if (
        first === 0 ||
        first === 10 ||
        first === 127 ||
        first >= 224 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 198 && (second === 18 || second === 19))
      )
        return;
    }
    if (host.startsWith("[") && !/^\[[23][0-9a-f]{0,3}:/i.test(host)) return;
    if (
      /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?$)/.test(
        host,
      ) ||
      /^(172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
      /\.(local|internal)$/.test(host)
    )
      return;
    return url.href;
  } catch {
    return;
  }
}

// All enrichment precedes the final sanitizer. Source styles/classes never enter
// the reader; only classes/attributes generated here are allowed through.
export function normalizeArticleHtml(raw: string, url: string, title = "") {
  const $ = cheerio.load(raw, {}, false);
  $("script[type^='math/tex']").each((_, element) => {
    const replacement = $("<span></span>").text($(element).text());
    $(element).replaceWith(replacement);
  });
  $(
    "script,style,iframe,object,embed,form,input,button,textarea,select,nav,aside,footer,noscript,template,link,meta,base,svg",
  ).remove();
  $("video,audio").each((_, element) => {
    const link = safeUrl(
      $(element).attr("src") || $(element).find("source").first().attr("src"),
      url,
    );
    $(element).replaceWith(
      link
        ? $("<p></p>").append(
            $("<a></a>").attr("href", link).text("在原站查看媒体"),
          )
        : $("<p></p>").text("媒体内容请阅读原文。"),
    );
  });
  $("h1").each((_, element) => {
    if (normalizedText($(element).text()) === normalizedText(title))
      $(element).remove();
    else $(element).replaceWith($("<h2></h2>").html($(element).html() || ""));
  });
  const anchors = new Map<string, string>();
  const used = new Set<string>();
  $("[id],a[name]").each((index, element) => {
    const old = $(element).attr("id") || $(element).attr("name");
    const id = `article-anchor-${index + 1}`;
    if (old && !anchors.has(old)) anchors.set(old, id);
    $(element).attr("id", id);
  });
  const headings: ParsedArticle["headings"] = [];
  $("h2,h3").each((_, element) => {
    const node = $(element),
      text = normalizedText(node.text());
    if (!text) return;
    const base = `section-${
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "heading"
    }`;
    let id = base,
      suffix = 1;
    while (used.has(id)) id = `${base}-${++suffix}`;
    used.add(id);
    const previous = node.attr("id");
    for (const [old, target] of anchors)
      if (target === previous) anchors.set(old, id);
    node.attr("id", id);
    headings.push({ id, level: Number(element.tagName[1]), text });
  });
  $("*").each((_, element) => {
    if (!("tagName" in element)) return;
    const node = $(element);
    const codeClass =
      element.tagName === "code"
        ? (node.attr("class") || "")
            .split(/\s+/)
            .find((value) => /^language-[a-z0-9_+-]{1,40}$/i.test(value))
        : undefined;
    // Strip publisher formatting before applying the shared editorial styles.
    node.removeAttr("style class name");
    if (codeClass) node.attr("class", codeClass);
    if (element.tagName === "a") {
      let href = node.attr("href");
      try {
        const resolved = new URL(href || "", url),
          current = new URL(url);
        if (
          resolved.origin === current.origin &&
          resolved.pathname === current.pathname &&
          resolved.search === current.search &&
          resolved.hash
        )
          href = resolved.hash;
      } catch {
        /* Invalid links become plain text. */
      }
      if (href?.startsWith("#")) {
        let original = href.slice(1);
        try {
          original = decodeURIComponent(original);
        } catch {
          /* Keep literal anchor. */
        }
        href = anchors.has(original) ? `#${anchors.get(original)}` : undefined;
      } else href = safeUrl(href, url);
      node.removeAttr("href target rel");
      if (href) {
        node.attr("href", href);
        if (!href.startsWith("#"))
          node.attr({ target: "_blank", rel: "noopener noreferrer" });
      }
    }
    if (element.tagName === "img") {
      const src = safeUrl(
        node.attr("data-src") ||
          node.attr("data-original") ||
          node.attr("data-actualsrc") ||
          node.attr("data-lazy-src") ||
          node.attr("src"),
        url,
        true,
      );
      if (!src) {
        node.remove();
        return;
      }
      const label = node.attr("alt") || "文章图片";
      node.attr({
        src,
        alt: node.attr("alt") || "",
        loading: "lazy",
        decoding: "async",
        referrerpolicy: "no-referrer",
        role: "button",
        tabindex: "0",
        "aria-label": `查看大图：${label}`,
      });
      for (const key of ["width", "height"]) {
        const value = node.attr(key);
        if (!value || !/^\d{1,5}$/.test(value) || Number(value) <= 1)
          node.removeAttr(key);
      }
    }
  });
  $("table").each((_, element) => {
    $(element).wrap('<div class="markdown-table-wrap"></div>');
  });
  $("h2,h3").each((_, element) => {
    const node = $(element),
      id = node.attr("id");
    if (id)
      node.append(
        $("<a></a>")
          .attr({
            class: "heading-anchor",
            href: `#${id}`,
            "aria-label": `链接到本节：${normalizedText(node.text())}`,
          })
          .text("#"),
      );
  });
  const text = normalizedText($.root().text());
  const html = purifier.sanitize($.root().html() || "", {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: attributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ["svg", "math"],
  });
  return {
    html,
    headings,
    textLength: text.length,
    readingMinutes: Math.max(1, Math.ceil(text.length / 450)),
  };
}

export class ArticleParser {
  readonly rules: ParserRule[];
  constructor(
    rules: ParserRule[] = parserRules,
    readonly extractors: StructuredExtractor[] = structuredExtractors,
  ) {
    this.rules = rules.map((rule) => parserRuleSchema.parse(rule));
    if (new Set(this.rules.map((rule) => rule.id)).size !== this.rules.length)
      throw new Error("Duplicate parser rule ID");
    for (const rule of this.rules)
      if (rule.pathPattern) new RegExp(rule.pathPattern);
  }
  match(input: string) {
    const url = new URL(input);
    return this.rules.find(
      (rule) =>
        rule.hosts.includes(url.hostname) &&
        (!rule.pathPattern || new RegExp(rule.pathPattern).test(url.pathname)),
    );
  }
  revision(id: string) {
    return (
      this.rules.find((rule) => rule.id === id)?.version ||
      this.extractors.find((extractor) => extractor.id === id)?.version ||
      "1"
    );
  }
  parse(input: ParseInput): ParsedArticle {
    if (input.content.length > 8 * 1024 * 1024)
      throw new Error("Article exceeds parser size limit");
    if (!input.fragment && input.format !== "markdown") {
      const hostname = new URL(input.url).hostname;
      for (const extractor of this.extractors) {
        if (!extractor.hosts.includes(hostname)) continue;
        const extracted = extractor.extract(input);
        if (extracted) {
          input = { ...extracted, ruleVersion: extractor.version };
          break;
        }
      }
    }
    const rule = this.match(input.url);
    let html =
      input.format === "markdown" || input.format === "markdown-tokens"
        ? marked.parse(
            input.format === "markdown-tokens"
              ? tokensToMarkdown(input.content)
              : input.content,
            { async: false, gfm: true },
          )
        : input.content;
    let title = input.title || "",
      ruleId = input.ruleId || "publisher-fragment",
      ruleVersion = input.ruleVersion || "1";
    const warnings: string[] = [];
    if (!input.fragment && input.format !== "markdown") {
      const $ = cheerio.load(html);
      if (
        /^(验证码|访问验证|安全验证|登录|access denied|just a moment|sign in|404|403)/i.test(
          $("title").text().trim(),
        )
      )
        throw new Error("Article is an access or error page");
      if (rule) {
        for (const selector of rule.title) {
          const found = normalizedText($(selector).first().text());
          if (found) {
            title ||= found;
            break;
          }
        }
        const selector = rule.include.find(
          (value) =>
            $(value).length &&
            (normalizedText($(value).first().text()).length > 0 ||
              $(value).first().find("img").length > 0),
        );
        if (selector) {
          const root = $(selector).first().clone();
          for (const exclude of rule.exclude) root.find(exclude).remove();
          html = root.html() || "";
          ruleId = rule.id;
          ruleVersion = rule.version;
        } else throw new Error(`No body matched parser rule: ${rule.id}`);
      } else html = "";
      if (!html) {
        const dom = new JSDOM(input.content, { url: input.url });
        try {
          const article = new Readability(dom.window.document, {
            charThreshold: 0,
          }).parse();
          if (!article?.content)
            throw new Error("No readable article body found");
          html = article.content;
          title ||= article.title || "";
          ruleId = "readability";
          // Generic extraction cannot establish source completeness by itself.
          warnings.push("正文由通用规则提取，完整性尚待核对。");
        } finally {
          dom.window.close();
        }
      }
    }
    const result = normalizeArticleHtml(html, input.url, title);
    const imageCount = cheerio.load(result.html)("img").length;
    if ((result.textLength === 0 && imageCount === 0) || !result.html)
      throw new Error("No readable article body found");
    const plain = cheerio.load(html).text();
    if (plain.includes("嵌入内容请阅读原文。"))
      warnings.push("部分嵌入内容无法转换，请在原文中查看。");
    if (
      /剩余内容.{0,15}(付费|会员|登录)|登录后.{0,8}(查看全文|阅读全文)|订阅后.{0,8}(查看|阅读)|本文仅展示部分|全文内容已隐藏/.test(
        plain,
      )
    )
      warnings.push("原站提示正文存在阅读限制。");
    return {
      ...result,
      title,
      status: warnings.length ? "partial" : "ready",
      ruleId,
      ruleVersion,
      warnings,
      sourceUrl: input.url,
    };
  }
}

export const articleParser = new ArticleParser();
