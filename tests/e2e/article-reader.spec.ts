import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

async function bodyIndex(request: APIRequestContext) {
  return (await (await request.get("data/bodies.json")).json())
    .bodies as Array<{
    articleId: string;
    status: string;
    headingCount: number;
    imageCount: number;
  }>;
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("reader follows the reference layout, tracks anchors and previews images with keyboard focus", async ({
  page,
  request,
  isMobile,
}, info) => {
  const bodies = await bodyIndex(request);
  const readable = bodies.find(
    (body) =>
      body.status === "ready" && body.headingCount > 1 && body.imageCount > 0,
  )!;
  expect(readable).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    route.request().resourceType() === "image" &&
    !route.request().url().startsWith("http://localhost:")
      ? route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#e5e5e0"/><path d="M140 160h360M320 70v180" stroke="#625a8c" stroke-width="8"/></svg>',
        })
      : route.continue(),
  );
  await page.goto(`./articles/${readable.articleId}/`);
  const body = page.locator(".markdown-body");
  await expect(body).toBeVisible();
  await expect(body).toHaveCSS("font-size", "15px");
  await expect(body).toHaveCSS("line-height", "28.5px");
  await expect(
    body.locator("script,iframe,style,form,[onclick],[onerror]"),
  ).toHaveCount(0);
  await expect(page.locator(".reading-progress")).toBeVisible();
  await expect(
    page.locator(".reader-actions").getByRole("link", { name: "阅读原文" }),
  ).toBeVisible();
  const mobileToc = page.locator(".article-toc-mobile");
  if (isMobile) {
    await expect(page.locator(".article-toc")).toBeHidden();
    await mobileToc.locator("summary").click();
  } else {
    await expect(page.locator(".article-toc")).toBeVisible();
    await expect(mobileToc).toBeHidden();
  }
  const toc = isMobile ? mobileToc : page.locator(".article-toc");
  const heading = toc.locator("a").last();
  const target = await heading.getAttribute("href");
  await heading.click();
  await expect(page).toHaveURL(
    (url) => decodeURIComponent(url.hash) === target,
  );
  await expect(heading).toHaveAttribute("aria-current", "location");
  if (isMobile) await mobileToc.locator("summary").click();
  const image = body.locator("img").first();
  await image.scrollIntoViewIfNeeded();
  await image.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "关闭图片预览" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "关闭图片预览" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(image).toBeFocused();
  await noOverflow(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("article-reader.png"),
    fullPage: false,
  });
  expect(errors).toEqual([]);
});

test("returning from a blog restores the selected company, loaded batches and independent scroll positions", async ({
  page,
  request,
}) => {
  const { articles } = await (await request.get("data/articles.json")).json();
  const counts = new Map<string, number>();
  for (const article of articles.filter(
    (article: { contentType?: string }) => article.contentType !== "paper",
  ))
    counts.set(article.companyId, (counts.get(article.companyId) || 0) + 1);
  const company = [...counts].find(([, count]) => count > 20)![0];
  await page.goto(`./?company=${company}&page=2`);
  const list = page.locator(`#panel-${company}`).getByRole("region");
  await expect(list.locator("article")).toHaveCount(
    Math.min(40, counts.get(company)!),
  );
  await list.evaluate((element) => {
    element.scrollTop = 300;
  });
  const link = list.locator("h3 a").nth(5);
  await link.scrollIntoViewIfNeeded();
  const top = await list.evaluate((element) => element.scrollTop);
  const boardUrl = page.url();
  await link.click();
  await expect(
    page.getByRole("button", { name: "返回博文看板" }),
  ).toBeVisible();
  const previous = page.getByRole("link", { name: /^上一篇：/ });
  if (await previous.count()) {
    const destination = new URL(
      (await previous.getAttribute("href"))!,
      page.url(),
    ).href;
    await previous.click();
    await expect(page).toHaveURL(destination);
  }
  await page.getByRole("button", { name: "返回博文看板" }).click();
  await expect(page).toHaveURL(boardUrl);
  await expect(list.locator("article")).toHaveCount(
    Math.min(40, counts.get(company)!),
  );
  await expect
    .poll(async () =>
      Math.abs((await list.evaluate((element) => element.scrollTop)) - top),
    )
    .toBeLessThan(2);
  await noOverflow(page);
});

test("partial and unavailable content retain the original link and direct reader reload works", async ({
  page,
  request,
}) => {
  const bodies = await bodyIndex(request);
  for (const status of ["partial", "unavailable"]) {
    const selected = bodies.find((body) => body.status === status);
    if (!selected) continue;
    await page.goto(`./articles/${selected.articleId}/`);
    await expect(
      page.locator(".reader-actions").getByRole("link", { name: "阅读原文" }),
    ).toHaveAttribute("target", "_blank");
    if (status === "partial")
      await expect(page.locator(".reader-notice")).toContainText(
        "正文可能不完整",
      );
    else {
      await expect(page.locator(".reader-unavailable")).toContainText(
        "正文暂时不可用",
      );
      await expect(page.locator(".markdown-body")).toHaveCount(0);
    }
    await page.reload();
    await expect(page.locator("h1")).toBeVisible();
    await noOverflow(page);
  }
});
