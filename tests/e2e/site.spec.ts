import { test, expect } from "@playwright/test";
test("search, filters, empty state and URL history", async ({ page }) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "国内技术文章", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("搜索文章", { exact: true })
    .fill("no-such-radar-article");
  await expect(
    page.getByRole("heading", { name: "暂时没有匹配的文章" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/q=no-such/);
  await page.reload();
  await expect(page.getByLabel("搜索文章", { exact: true })).toHaveValue(
    "no-such-radar-article",
  );
  await page.getByRole("button", { name: "清空筛选" }).click();
  await page.getByRole("combobox", { name: "公司", exact: true }).click();
  await page.getByRole("option", { name: "美团", exact: true }).click();
  await expect(page).toHaveURL(/company=meituan/);
  await expect(page.locator(".article-list .company").first()).toHaveText(
    "美团",
  );
  await page.getByRole("combobox", { name: "排序", exact: true }).click();
  await page.getByRole("option", { name: "最早优先", exact: true }).click();
  await expect(page).toHaveURL(/sort=oldest/);
  await page.goBack();
  await expect(
    page.getByRole("combobox", { name: "排序", exact: true }),
  ).toHaveText("最新优先");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("pagination, article deep links, feeds and keyboard focus", async ({
  page,
  request,
}) => {
  await page.goto("./");
  if (await page.getByRole("button", { name: "下一页" }).count()) {
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page).toHaveURL(/page=2/);
  }
  await page.locator(".article-row h2 a").first().click();
  await expect(page).toHaveURL(/\/articles\/[^/?]+\/?$/);
  await expect(
    page.getByRole("heading", { name: "来源与发布信息" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /阅读原文/ })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "来源与发布信息" }),
  ).toBeVisible();
  await page.goto("./sources/");
  expect(await page.locator(".source-row").count()).toBeGreaterThanOrEqual(19);
  await expect(page.getByText("来源目录", { exact: true })).toBeVisible();
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
  const violations = await page.evaluate(
    () =>
      [...document.querySelectorAll("input,select")].filter(
        (e) => !e.id || !document.querySelector(`label[for="${e.id}"]`),
      ).length,
  );
  expect(violations).toBe(0);
});
test("domestic sources, direct indexing and contribution links", async ({
  page,
  request,
}) => {
  const companies = (await (await request.get("data/companies.json")).json())
    .companies;
  expect(companies.length).toBeGreaterThan(0);
  expect(companies.every((c: { region: string }) => c.region === "cn")).toBe(
    true,
  );
  const articles = (await (await request.get("data/articles.json")).json())
    .articles;
  expect(
    articles.every(
      (a: { classification: { method: string; topics: string[] } }) =>
        a.classification.method === "source" &&
        a.classification.topics.length === 0,
    ),
  ).toBe(true);
  await page.goto("./");
  await expect(
    page.getByRole("combobox", { name: "主题", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "关于", exact: true }).click();
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
