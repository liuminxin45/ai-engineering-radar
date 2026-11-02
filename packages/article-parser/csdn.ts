import type { CheerioAPI } from "cheerio";

// Editor HTML can store each line as a sibling <code>. Selecting only the
// first loses code; flattening without line breaks changes its meaning.
export function normalizeCsdnCode($: CheerioAPI) {
  $("pre").each((_, pre) => {
    const lines = $(pre).children("code");
    if (!lines.length) return;
    const lineText = (line: (typeof lines)[number]) => {
      const copy = $(line).clone();
      copy.find("br").replaceWith("\n");
      return copy.text().replaceAll("\u00a0", " ");
    };
    const codeRows = lines.first().find(".hljs-ln-code");
    const storedRows = lines.first().children("ol").children("li");
    const text =
      lines.length > 1
        ? lines.toArray().map(lineText).join("\n")
        : codeRows.length
          ? codeRows.toArray().map(lineText).join("\n")
          : storedRows.length
            ? storedRows.toArray().map(lineText).join("\n")
            : lineText(lines[0]);
    // Re-escape code as plain text. CSDN SSR inserts hydration comments inside
    // Vue braces; passing those comments to DOMPurify can remove the whole code
    // node. Keep the sanitizer strict and remove only markup from the code.
    const code = $("<code></code>").text(text);
    const language = lines
      .first()
      .attr("class")
      ?.split(/\s+/)
      .find((value) => /^language-[a-z0-9_+-]{1,40}$/i.test(value));
    if (language) code.attr("class", language);
    $(pre).empty().append(code);
  });
}
