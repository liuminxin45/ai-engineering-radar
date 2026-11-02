import { it, expect } from "vitest";
import { maskPublisherBody } from "../../packages/publisher/public-check.js";

it("masks exact publisher markup in HTML and Flight without masking private data outside it", () => {
  const html = "<pre><code>http://127.0.0.1:5001</code></pre>";
  const value = `<div>${html}</div><script>self.__next_f.push([1,${JSON.stringify(JSON.stringify({ __html: html }))}])</script><span>http://127.0.0.1:9000/private</span>`;
  const masked = maskPublisherBody(value, html);
  expect(masked).not.toContain("5001");
  expect(masked).toContain("http://127.0.0.1:9000/private");
  expect(maskPublisherBody(value, "<p>Different body</p>")).toBe(value);
  expect(maskPublisherBody(value, "")).toBe(value);
});
