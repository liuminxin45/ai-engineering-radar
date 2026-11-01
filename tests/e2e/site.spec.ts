import { test, expect } from "@playwright/test";
test("search, filters, empty state and URL history", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /发现真实/ })).toBeVisible();
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
  await page.getByLabel("公司", { exact: true }).selectOption("meituan");
  await expect(page).toHaveURL(/company=meituan/);
  await expect(page.locator(".article-list .company").first()).toHaveText(
    "美团",
  );
  await page.getByLabel("主题", { exact: true }).selectOption("agent");
  await expect(page).toHaveURL(/topic=agent/);
  await page.goBack();
  await expect(page.getByLabel("主题", { exact: true })).toHaveValue("");
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
  await expect(page.getByRole("link", { name: /阅读原文/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "为什么收录" })).toBeVisible();
  await page.goto("./sources/");
  await expect(page.locator(".source-row")).toHaveCount(41);
  await expect(page.getByText("来源目录", { exact: true })).toBeVisible();
  for (const path of [
    "feed.xml",
    "feed.atom",
    "feed/company/meituan.xml",
    "feed/topic/agent.atom",
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
