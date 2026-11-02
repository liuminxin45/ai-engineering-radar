import { expect, it } from "vitest";
import { resolveSiteUrl } from "../../packages/shared/site.js";

it("defaults page metadata and feed exports to the deployed public address", () => {
  expect(resolveSiteUrl({})).toBe(
    "https://liuminxin45.github.io/ai-engineering-radar",
  );
  expect(
    resolveSiteUrl({
      SITE_URL: "https://example.org/",
      BASE_PATH: "/preview/",
    }),
  ).toBe("https://example.org/preview");
  expect(
    resolveSiteUrl({ SITE_URL: "https://example.org", BASE_PATH: "" }),
  ).toBe("https://example.org");
});

it("rejects loopback and malformed publishing addresses before generating output", () => {
  for (const SITE_URL of [
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://[::1]",
    "https://example.org/path",
    "https://example.org?x=1",
    "https://user@example.org",
  ])
    expect(() => resolveSiteUrl({ SITE_URL })).toThrow("SITE_URL");
  for (const BASE_PATH of ["relative", "//other.example", "/path?query=1"])
    expect(() => resolveSiteUrl({ BASE_PATH })).toThrow("BASE_PATH");
});
