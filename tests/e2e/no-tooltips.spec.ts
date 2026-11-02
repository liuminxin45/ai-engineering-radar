import { test, expect, type Page } from "@playwright/test";

async function expectNoTooltips(page: Page) {
  // Checking the kit's trigger wrappers also catches delayed hover hints.
  await expect(
    page.locator(
      '[title], .desktop-action-tooltip, .desktop-tooltip, [role="tooltip"]',
    ),
  ).toHaveCount(0);
}

test("controls and dates have no hover hints and retain accessible names", async ({
  page,
  isMobile,
}) => {
  await page.goto("./");
  const feed = page.getByRole("button", { name: "ATOM/RSS", exact: true });
  await expect(feed).toBeVisible();
  await expectNoTooltips(page);
  const appearance = page.getByRole("button", { name: /切换到.*外观/ });
  const github = page.getByRole("link", { name: "GitHub 项目", exact: true });
  const company = page
    .getByRole("navigation", { name: "定位公司面板" })
    .getByRole("button")
    .first();
  for (const action of [appearance, feed, github, company]) {
    await action.hover();
    await expectNoTooltips(page);
    await action.focus();
    await expect(action).toBeFocused();
    await expectNoTooltips(page);
  }
  await feed.click();
  const dialog = page.getByRole("dialog", { name: "订阅整个项目" });
  await expect(dialog).toBeVisible();
  for (const action of [
    dialog.getByRole("button", { name: "复制 RSS 链接", exact: true }),
    dialog.getByRole("button", { name: "复制 ATOM 链接", exact: true }),
    dialog.getByRole("button", { name: "关闭订阅窗口", exact: true }),
  ]) {
    await action.hover();
    await expectNoTooltips(page);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(feed).toBeFocused();
  if (isMobile) {
    await page.getByRole("button", { name: "搜索文章", exact: true }).click();
    const close = page.getByRole("button", { name: "关闭搜索", exact: true });
    await close.hover();
    await expectNoTooltips(page);
    await close.click();
  }
  const data = await (await page.request.get("data/articles.json")).json();
  await page.goto(`./articles/${data.articles[0].id}/`);
  await expect(page.locator("main h1")).toBeVisible();
  await expectNoTooltips(page);
  await page.goto("./about/");
  await expect(
    page.getByRole("heading", { name: "About this project", exact: true }),
  ).toBeVisible();
  await expectNoTooltips(page);
});
