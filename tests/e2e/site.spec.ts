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

test("panels scroll independently and support keyboard, buttons and touch", async ({
  page,
  isMobile,
  browserName,
}) => {
  await page.goto("./");
  const viewport = board(page);
  await expect(viewport).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeVisible();
  expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(48);
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
  await page.getByRole("button", { name: "向右切换面板", exact: true }).click();
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

test("each panel loads more in batches and detail links keep the project subpath", async ({
  page,
  request,
}) => {
  await page.goto("./");
  const latest = latestList(page);
  await expect(latest.locator("article")).toHaveCount(20);
  await latest.getByRole("button", { name: /^加载更多/ }).click();
  await expect(latest.locator("article")).toHaveCount(40);
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(latestList(page).locator("article")).toHaveCount(40);
  await page.goBack();
  await expect(latestList(page).locator("article")).toHaveCount(20);
  await page.goForward();
  await expect(latestList(page).locator("article")).toHaveCount(40);
  const original = latestList(page)
    .getByRole("link", { name: /^阅读原文：/ })
    .first();
  await expect(original).toHaveAttribute("target", "_blank");
  await expect(original).toHaveAttribute("rel", /noopener/);
  await latestList(page).locator("article h3 a").first().click();
  await expect(page).toHaveURL(/\/ai-engineering-radar\/articles\/[^/?]+\/?$/);
  await expect(
    page.getByRole("heading", { name: "来源与发布信息" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /阅读原文/ })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "来源与发布信息" }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);
  for (const path of [
    "feed.xml",
    "feed.atom",
    "feed/company/meituan.xml",
    "feed/company/meituan.atom",
    "data/articles.json",
  ])
    expect((await request.get(path)).ok()).toBe(true);
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "跳转到主要内容" }),
  ).toBeFocused();
  expect(await page.getByLabel(searchName, { exact: true }).count()).toBe(1);
});

test("domestic provenance, history labels and contribution destinations remain available", async ({
  page,
  request,
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
  ).toBe(6);
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
  await page.goto("./sources/");
  expect(await page.locator(".source-row").count()).toBeGreaterThanOrEqual(19);
  expect(await page.getByText("历史渠道", { exact: true }).count()).toBe(6);
  await expect(page.getByText(/^最新收录文章/).first()).toBeVisible();
  await expectNoDocumentOverflow(page);
  await page.goto("./");
  await expect(
    page.getByRole("combobox", { name: "主题", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "更多选项", exact: true }).click();
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
});
