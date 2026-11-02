import { test, expect, type Locator, type Page } from "@playwright/test";

async function expectIconFeedback(
  page: Page,
  action: Locator,
  muted: string,
  highlighted: string,
) {
  await page.mouse.move(1, 1);
  await action.evaluate((element) => (element as HTMLElement).blur());
  await expect(action).toHaveCSS("color", muted);
  await expect(action).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(action).toHaveCSS("background-image", "none");
  await expect(action).toHaveCSS("width", "44px");
  await expect(action).toHaveCSS("height", "44px");
  await expect(action.locator("svg")).toHaveCSS("width", "18px");
  await expect(action.locator("svg")).toHaveCSS("height", "18px");

  await action.hover();
  await expect(action).toHaveCSS("color", highlighted);
  await expect(action).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(action).toHaveCSS("background-image", "none");
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} icon controls highlight without a background`, async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.addInitScript((preference) => {
      localStorage.setItem("radar-theme", preference);
    }, theme);
    await page.goto("./");
    await expect(page.locator(".radar-ui")).toHaveAttribute(
      "data-preference",
      theme,
    );
    const muted =
      theme === "light" ? "rgb(107, 107, 101)" : "rgb(161, 161, 170)";
    const highlighted =
      theme === "light" ? "rgb(39, 39, 42)" : "rgb(228, 228, 231)";
    const appearance = page.getByRole("button", {
      name: theme === "light" ? "切换到深色外观" : "切换到浅色外观",
      exact: true,
    });
    const feed = page.getByRole("button", { name: "ATOM/RSS", exact: true });
    const github = page.getByRole("link", { name: "GitHub 项目", exact: true });
    for (const action of [appearance, feed, github]) {
      await expectIconFeedback(page, action, muted, highlighted);
    }
    await page.locator("header").screenshot({
      path: testInfo.outputPath("toolbar.png"),
    });

    // Keyboard focus remains visible without the kit's default focus fill.
    await page.mouse.move(1, 1);
    await appearance.focus();
    await page.keyboard.press("Tab");
    await expect(feed).toBeFocused();
    await expect(feed).toHaveCSS("color", highlighted);
    await expect(feed).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(feed).toHaveCSS("outline-style", "solid");
    await expect(feed).toHaveCSS("outline-width", "2px");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "订阅整个项目" });
    await expect(dialog).toBeVisible();
    await expect(feed).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const close = dialog.getByRole("button", { name: "关闭订阅窗口" });
    await expectIconFeedback(page, close, muted, highlighted);
    await close.click();
    await expect(dialog).toHaveCount(0);

    if (isMobile) {
      const search = page.getByRole("button", {
        name: "搜索文章",
        exact: true,
      });
      await expectIconFeedback(page, search, muted, highlighted);
      await search.click();
      const closeSearch = page.getByRole("button", {
        name: "关闭搜索",
        exact: true,
      });
      // An expanded search control keeps the highlighted foreground.
      await page.mouse.move(1, 1);
      await expect(closeSearch).toHaveCSS("color", highlighted);
      await closeSearch.hover();
      await expect(closeSearch).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
      await expect(closeSearch).toHaveCSS("background-image", "none");
      await closeSearch.click();
      await expect(search).toBeVisible();
    }
  });
}
