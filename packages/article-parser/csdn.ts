import type { CheerioAPI } from "cheerio";

// Editor HTML can store each line as a sibling <code>. Selecting only the
// first loses code; flattening without line breaks changes its meaning.
export function normalizeCsdnCode($: CheerioAPI) {
  $("pre").each((_, pre) => {
    const lines = $(pre).children("code");
    if (lines.length < 2) return;
    const text = lines
      .toArray()
      .map((line) => $(line).text().replaceAll("\u00a0", " "))
      .join("\n");
    const code = $("<code></code>").text(text);
    $(pre).empty().append(code);
  });
}
