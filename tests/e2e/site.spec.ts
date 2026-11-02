import { test, expect, type Page } from "@playwright/test";
import { sourceReplacements } from "../../packages/source-registry/replacements.js";

const searchName = "搜索所有面板的文章";
const board = (page: Page) =>
  page.getByRole("main", { name: "横向浏览公司文章面板" });
const latestList = (page: Page) =>
  page.getByRole("region", { name: "最新文章列表", exact: true });
const companyList = (page: Page, name: string) =>
  page.getByRole("region", { name: `${name}文章列表`, exact: true });
async function revealSearch(page: Page) {
  const input = page.getByLabel(searchName, { exact: true });
  if (!(await input.isVisible()))
    await page.getByRole("button", { name: "搜索文章", exact: true }).click();
  await expect(input).toBeVisible();
  return input;
}
async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("search, company focus, sorting and URL history survive refresh", async ({
  page,
}) => {
  await page.goto("./");
  await expect(board(page)).toBeVisible();
  expect((await board(page).boundingBox())!.y).toBeLessThanOrEqual(132);
  await (await revealSearch(page)).fill("no-such-radar-article");
  await expect(latestList(page).locator("article")).toHaveCount(0);
  await expect(
    latestList(page)
      .getByText(/没有匹配|暂时没有/)
      .first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/q=no-such-radar-article/);
  await page.reload();
  await expect(await revealSearch(page)).toHaveValue("no-such-radar-article");
  await (await revealSearch(page)).fill("");
  const closeSearch = page.getByRole("button", {
    name: "关闭搜索",
    exact: true,
  });
  if (await closeSearch.isVisible()) await closeSearch.click();
  await page.getByRole("button", { name: "得物", exact: true }).click();
  await expect(page).toHaveURL(/company=dewu/);
  await expect(
    page.getByRole("button", { name: "得物", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await expect(companyList(page, "得物")).toBeVisible();
  await page.getByRole("button", { name: "更多选项", exact: true }).click();
  await page.getByRole("menuitem", { name: /最早优先/ }).click();
  await expect(page).toHaveURL(/sort=oldest/);
  await page.goBack();
  await expect(page).toHaveURL(/company=dewu/);
  await expect(page).not.toHaveURL(/sort=oldest/);
  await page.goForward();
  await expect(page).toHaveURL(/sort=oldest/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "得物", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await expectNoDocumentOverflow(page);
});

test("compact panels retain independent scrolling, keyboard and touch navigation", async ({
  page,
  isMobile,
  browserName,
}) => {
  await page.goto("./");
  const viewport = board(page);
  await expect(viewport).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /切换面板|加载更多|订阅$/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /原文|来源/ })).toHaveCount(0);
  await expect(page.getByText("所有公司", { exact: true })).toHaveCount(0);
  await expect(
    page.locator('a[href*="/feed/company/"], a[href*="/feed/topic/"]'),
  ).toHaveCount(0);
  const updated = page.locator("header time");
  await expect(updated).toHaveCount(1);
  await expect(updated).toBeVisible();
  const headerBox = (await page.locator("header").boundingBox())!;
  const updatedBox = (await updated.boundingBox())!;
  expect(updatedBox.x).toBeGreaterThan(headerBox.width / 2);
  expect(updatedBox.y + updatedBox.height).toBeLessThanOrEqual(
    headerBox.y + headerBox.height,
  );
  await expect(
    page.getByRole("button", { name: "最新", exact: true }),
  ).toHaveText("最新");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(
    "最新文章",
  );
  expect(await viewport.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(
    true,
  );
  const latest = latestList(page);
  await latest.evaluate((e) => {
    e.scrollTop = 220;
  });
  await expect
    .poll(() => latest.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(150);
  expect(await companyList(page, "得物").evaluate((e) => e.scrollTop)).toBe(0);
  expect(await viewport.evaluate((e) => e.scrollLeft)).toBe(0);
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => viewport.evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(200);
  const previous = await viewport.evaluate((e) => e.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => viewport.evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(previous + 200);
  await page.getByRole("button", { name: "最新", exact: true }).click();
  await expect.poll(() => viewport.evaluate((e) => e.scrollLeft)).toBe(0);
  if (isMobile && browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 290, y: 370 }],
      });
      for (let x = 275; x >= 50; x -= 15)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: 370 }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() => viewport.evaluate((e) => e.scrollLeft))
        .toBeGreaterThan(200);
    } finally {
      await cdp.detach();
    }
  }
  await expectNoDocumentOverflow(page);
});

test("scrolling appends one batch per bottom encounter and article titles open the publisher", async ({
  page,
  request,
}) => {
  await page.goto("./");
  const latest = latestList(page);
  await expect(latest.locator("article")).toHaveCount(20);
  await latest.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(latest.locator("article")).toHaveCount(40);
  await expect(page).toHaveURL(/page=2/);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(latest.locator("article")).toHaveCount(40);
  const data = (await (await request.get("data/articles.json")).json())
    .articles;
  const counts = new Map<string, number>();
  for (const article of data as { companyId: string }[])
    counts.set(article.companyId, (counts.get(article.companyId) ?? 0) + 1);
  const selected = [...counts.entries()].find(([, count]) => count > 20);
  expect(
    selected,
    "The snapshot must contain a company with a second batch",
  ).toBeTruthy();
  const [companyId, companyCount] = selected!;
  await page.locator(`#company-${companyId}`).click();
  const selectedList = page.locator(`#panel-${companyId}`).getByRole("region");
  await expect(selectedList.locator("article")).toHaveCount(20);
  await selectedList.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(selectedList.locator("article")).toHaveCount(
    Math.min(40, companyCount),
  );
  await expect(latest.locator("article")).toHaveCount(40);
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("company") === companyId &&
      url.searchParams.get("page") === "2",
  );
  await page.reload();
  await expect(selectedList.locator("article")).toHaveCount(
    Math.min(40, companyCount),
  );
  await page.goBack();
  await expect(page).not.toHaveURL(/company=/);
  await expect(latestList(page).locator("article")).toHaveCount(40);
  await page.goForward();
  await expect(selectedList.locator("article")).toHaveCount(
    Math.min(40, companyCount),
  );
  const original = selectedList.locator("article h3 a").first();
  const canonical = await original.getAttribute("href");
  expect(canonical).toMatch(/^https?:\/\//);
  await expect(original).toHaveAttribute("target", "_blank");
  await expect(original).toHaveAttribute("rel", /noopener/);
  await expect(original.locator(".link-label")).toHaveCount(1);
  const intercepted = new URL(canonical!).href;
  await page.context().route(
    (url) => url.href === intercepted,
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Publisher article</title>",
      }),
  );
  const popupPromise = page.waitForEvent("popup");
  await original.click();
  const popup = await popupPromise;
  await popup.waitForURL(intercepted);
  await popup.close();
  const article = data.find(
    (a: { canonicalUrl: string }) => a.canonicalUrl === canonical,
  );
  expect(article).toBeTruthy();
  await page.goto(`./articles/${article.id}/`);
  await expect(page).toHaveURL(/\/ai-engineering-radar\/articles\/[^/?]+\/?$/);
  await expect(
    page.getByRole("heading", { name: "来源与发布信息" }),
  ).toBeVisible();
  await expect(page.locator("h1 a")).toHaveAttribute("href", canonical!);
  await expect(
    page.getByRole("link", { name: /阅读原文|订阅这家公司|来源目录/ }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "来源与发布信息" }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);
  for (const path of ["feed.xml", "feed.atom", "data/articles.json"])
    expect((await request.get(path)).ok()).toBe(true);
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "跳转到主要内容" }),
  ).toBeFocused();
  expect(await page.getByLabel(searchName, { exact: true }).count()).toBe(1);
});

test("domestic provenance stays public while the interface exposes only whole-project feeds", async ({
  page,
  request,
  isMobile,
}) => {
  const companies = (await (await request.get("data/companies.json")).json())
    .companies;
  expect(companies.length).toBeGreaterThan(0);
  expect(companies.every((c: { region: string }) => c.region === "cn")).toBe(
    true,
  );
  const sources = (await (await request.get("data/sources.json")).json())
    .sources;
  for (const id of [
    "dewu-csdn",
    "aliyun-cloud-native",
    "aliyun-dataphin",
    "bytedance-volcengine",
    "ant-ling",
    "ant-oceanbase-csdn",
    "baidu-cloud-csdn-candidate",
  ]) {
    const source = sources.find((s: { id: string }) => s.id === id);
    expect(source.crawl.enabled).toBe(true);
    expect(source.verification.status).toBe("verified");
    expect(source).toHaveProperty("latestPublishedAt");
  }
  expect(
    sources.filter(
      (s: { verification: { status: string } }) =>
        s.verification.status === "suspended",
    ).length,
  ).toBe(3);
  for (const { sourceId, replacementIds } of sourceReplacements) {
    expect(sources.some((s: { id: string }) => s.id === sourceId)).toBe(false);
    for (const id of replacementIds)
      expect(
        sources.find((s: { id: string }) => s.id === id).crawl.enabled,
      ).toBe(true);
  }
  const articles = (await (await request.get("data/articles.json")).json())
    .articles;
  const retiredIds = new Set<string>(sourceReplacements.map((s) => s.sourceId));
  expect(
    articles.every((a: { locations: { sourceId: string }[] }) =>
      a.locations.every((l) => !retiredIds.has(l.sourceId)),
    ),
  ).toBe(true);
  expect(
    articles.every(
      (a: { classification: { method: string; topics: string[] } }) =>
        a.classification.method === "source" &&
        a.classification.topics.length === 0,
    ),
  ).toBe(true);
  expect((await request.get("sources/")).status()).toBe(404);
  for (const path of ["feed/company/meituan.xml", "feed/company/meituan.atom"])
    expect((await request.get(path)).status()).toBe(404);
  await page.goto("./");
  await expect(page.locator('a[href*="/sources/"]')).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "全站 RSS 订阅", exact: true }),
  ).toHaveAttribute("href", "/ai-engineering-radar/feed.xml");
  const title = latestList(page).locator("article h3 a").first();
  const underline = title.locator(".link-label");
  const normalSize = await underline.evaluate(
    (e) => getComputedStyle(e).backgroundSize,
  );
  expect(normalSize).toBe("0% 1px");
  if (!isMobile) {
    await title.hover();
    await expect
      .poll(() => underline.evaluate((e) => getComputedStyle(e).backgroundSize))
      .toBe("100% 1px");
    expect(
      await underline.evaluate((e) => getComputedStyle(e).transitionDuration),
    ).toBe("0.3s");
  } else {
    expect(
      await underline.evaluate((e) => getComputedStyle(e).transitionDuration),
    ).toBe("0s");
  }
  await expect(
    page.getByRole("combobox", { name: "主题", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "更多选项", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /来源目录/ })).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "全站 Atom 订阅", exact: true }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: /关于项目/ }).click();
  await expect(
    page.getByRole("heading", { name: "About this project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "首批收录政策", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('a[href*="CONTRIBUTING.md"]').first(),
  ).toBeVisible();
  await expect(
    page.locator(
      'a[href*="/sources/"], a[href*="/feed/company/"], a[href*="/feed/topic/"]',
    ),
  ).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});
