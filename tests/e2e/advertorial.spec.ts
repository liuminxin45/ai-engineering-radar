import { expect, test } from "@playwright/test";

test("trial labels remain visible, fit the bottom right, and link to review evidence", async ({
  page,
  request,
}, testInfo) => {
  const response = await request.get("data/advertorial-review.json");
  expect(response.ok()).toBe(true);
  const report = await response.json();
  expect(report.mode).toBe("label-only");
  expect(report.suspectedCount).toBeGreaterThan(0);
  const sample = report.articles[0];
  const index = await (await request.get("data/articles.json")).json();
  expect(index.articles).toHaveLength(report.articleCount);
  expect(
    index.articles.find((a: { id: string }) => a.id === sample.id)
      .publicationStatus,
  ).toBe("published");
  await page.goto(`./?q=${encodeURIComponent(sample.title)}`);
  const article = page
    .getByRole("region", { name: "最新文章列表", exact: true })
    .locator("article")
    .filter({
      has: page.getByRole("link", { name: sample.title, exact: true }),
    })
    .first();
  const title = article.getByRole("link", { name: sample.title, exact: true });
  await expect(title).toHaveAttribute(
    "href",
    `/ai-engineering-radar/articles/${sample.id}/`,
  );
  const badge = article.getByRole("link", {
    name: "疑似软文：查看标记依据",
    exact: true,
  });
  await expect(badge).toHaveText("疑似软文");
  await expect(badge).toBeVisible();
  const cardBox = (await article.boundingBox())!;
  const badgeBox = (await badge.boundingBox())!;
  expect(
    Math.abs(badgeBox.x + badgeBox.width - cardBox.x - cardBox.width),
  ).toBeLessThan(2);
  expect(badgeBox.y).toBeGreaterThan(cardBox.y + cardBox.height / 2);
  expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(
    cardBox.y + cardBox.height,
  );
  expect(
    await badge.evaluate((e) => {
      const style = getComputedStyle(e);
      const luminance = (color: string) => {
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((n) => {
            const v = n / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const ink = luminance(style.color),
        background = luminance(style.backgroundColor);
      return (
        (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05)
      );
    }),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("advertorial-label.png") });
  await badge.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`articles/${sample.id}/#advertorial-review`),
  );
  await expect(
    page.getByRole("heading", { name: "疑似软文 · 试运行", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(sample.advertorial.reason, { exact: true }),
  ).toBeVisible();
  expect((await request.get(`data/articles/${sample.id}.json`)).ok()).toBe(
    true,
  );
});
