import { expect, test } from "@playwright/test";

test("title scores fit the bottom right, respect advertorial priority, and exclude papers", async ({
  page,
  request,
}, testInfo) => {
  const index = await (await request.get("data/articles.json")).json();
  const sample = index.articles.find(
    (a: { readingScore?: unknown }) => a.readingScore,
  );
  // Production snapshots may legitimately have no scores before a key is configured.
  test.skip(!sample, "This snapshot has no title scores.");
  for (const article of index.articles) {
    if (
      article.contentType === "paper" ||
      article.advertorial?.status === "suspected"
    )
      expect(article.readingScore).toBeUndefined();
  }
  await page.goto(`./?q=${encodeURIComponent(sample.title)}`);
  const card = page
    .getByRole("region", { name: "最新文章列表", exact: true })
    .locator("article")
    .filter({
      has: page.getByRole("link", { name: sample.title, exact: true }),
    })
    .first();
  const badge = card.locator("[data-reading-score]");
  await expect(badge).toHaveText(
    `${sample.readingScore.displayName} ${sample.readingScore.score}`,
  );
  await expect(badge).toHaveAttribute("aria-label", /标题工程相关性评分/);
  await expect(badge).toHaveAttribute("role", "meter");
  await expect(badge).toHaveAttribute(
    "aria-valuenow",
    String(sample.readingScore.score),
  );
  await expect(badge).not.toHaveAttribute("title");
  for (const theme of ["light", "dark"]) {
    await page.locator(".radar-ui").evaluate((element, theme) => {
      element.setAttribute("data-preference", theme);
    }, theme);
    const cardBox = (await card.boundingBox())!,
      badgeBox = (await badge.boundingBox())!;
    expect(
      Math.abs(badgeBox.x + badgeBox.width - cardBox.x - cardBox.width),
    ).toBeLessThan(2);
    expect(badgeBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height / 2);
    expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(
      cardBox.y + cardBox.height,
    );
    const date = (await card.locator("time").boundingBox())!;
    expect(badgeBox.x).toBeGreaterThanOrEqual(date.x + date.width);
    expect(
      await badge.evaluate((e) => {
        const css = getComputedStyle(e);
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((n) => {
              const v = n / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const a = luminance(css.color),
          b = luminance(css.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`reading-score-${theme}.png`),
    });
  }
  await page.goto("./?type=paper");
  await expect(page.locator("[data-reading-score]")).toHaveCount(0);
  const unscored = index.articles.find(
    (a: {
      contentType?: string;
      readingScore?: unknown;
      advertorial?: { status: string };
    }) =>
      a.contentType !== "paper" &&
      !a.readingScore &&
      a.advertorial?.status !== "suspected",
  );
  if (unscored) {
    await page.goto(`./?q=${encodeURIComponent(unscored.title)}`);
    await expect(page.locator("[data-reading-score]")).toHaveCount(0);
  }
  // A larger text size and landscape must preserve the numeric label and page bounds.
  await page.goto(`./?q=${encodeURIComponent(sample.title)}`);
  await page.addStyleTag({
    content: "[data-reading-score] { font-size: 24px !important; }",
  });
  await expect(page.locator("[data-reading-score]").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 812, height: 375 });
    await expect(page.locator("[data-reading-score]").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
