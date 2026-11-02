import { test, expect, type Route } from "@playwright/test";
const inputName = "搜索所有面板的文章";
test("search lives beside utility icons, opens immediately, traps focus and restores the trigger", async ({
  page,
  isMobile,
}, info) => {
  await page.goto("./");
  const trigger = page.getByRole("button", { name: "搜索文章", exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.locator("header input:visible")).toHaveCount(0);
  const github = page.getByRole("link", { name: "GitHub 项目", exact: true });
  expect((await trigger.boundingBox())!.x).toBeLessThan(
    (await github.boundingBox())!.x,
  );
  expect((await trigger.boundingBox())!.x).toBeGreaterThan(
    (await page.getByRole("tab", { name: "论文", exact: true }).boundingBox())!
      .x,
  );
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "搜索文章", exact: true });
  const input = page.getByRole("combobox", { name: inputName });
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(dialog.locator("footer")).toHaveCSS("margin-top", "0px");
  await expect(dialog.locator("footer")).toHaveCSS("flex-direction", "row");
  await expect(page.locator(".site-search-input")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, -1)",
  );
  await expect(dialog).toHaveCSS(
    "background-color",
    isMobile ? "rgb(34, 34, 37)" : "rgb(255, 255, 255)",
  );
  const rect = (await dialog.boundingBox())!;
  if (isMobile) {
    expect(rect.width).toBe(375);
    expect(rect.y).toBe(0);
  } else {
    expect(rect.width).toBe(512);
    expect(rect.y).toBeGreaterThan(50);
  }
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "关闭搜索", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.screenshot({ path: info.outputPath("search-empty.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Control+k");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+k");
  await expect(input).toBeFocused();
  await input.fill("AI");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).not.toHaveURL(/q=/);
  await trigger.click();
  await expect(input).toHaveValue("");
});

test("lazy search keeps the input available while modules are stalled and preserves typed text", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForLoadState("networkidle");
  const held: Route[] = [];
  let holding = true;
  await page.route("**/_next/static/chunks/**", (route) => {
    if (holding) held.push(route);
    else return route.continue();
  });
  await page.getByRole("button", { name: "搜索文章", exact: true }).click();
  const input = page.getByRole("combobox", { name: inputName });
  await expect(input).toBeFocused();
  await input.fill("AI");
  await expect(input).toHaveValue("AI");
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "关闭搜索", exact: true }).click();
  holding = false;
  await Promise.all(held.map((route) => route.continue()));
  await page.unroute("**/_next/static/chunks/**");
  await page.getByRole("button", { name: "搜索文章", exact: true }).click();
  await expect(input).toHaveValue("");
  await input.fill("AI");
  await expect(page.getByRole("listbox", { name: "搜索结果" })).toBeVisible();
  await expect(page.getByRole("option").first()).toBeVisible();
});

test("results paginate, highlight and open the local reader with keyboard activation", async ({
  page,
  context,
  request,
}, info) => {
  await page.goto("./");
  await page.getByRole("button", { name: "搜索文章", exact: true }).click();
  const input = page.getByRole("combobox", { name: inputName });
  await input.fill("a");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(10);
  await expect(page.getByRole("status").last()).toContainText("显示 10 /");
  const more = page.getByRole("button", { name: /加载更多/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect(options).toHaveCount(20);
  await input.focus();
  await page.keyboard.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    "search-result-0",
  );
  const first = page.locator("#search-result-0 a");
  await expect(
    page.locator("#search-result-0 .search-result-heading"),
  ).toHaveCSS("background-size", "100% 1px");
  await page.screenshot({ path: info.outputPath("search-results.png") });
  const href = await first.getAttribute("href");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(href!));
  await expect(
    page.locator(".reader-actions").getByRole("link", { name: "阅读原文" }),
  ).toBeVisible();
  await page.locator(".reader-back").click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(
    page.getByRole("tab", { name: "博文", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "论文", exact: true }).click();
  await page.getByRole("button", { name: "搜索论文", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "搜索所有面板的论文" }),
  ).toHaveValue("");
  const { articles } = await (await request.get("data/articles.json")).json();
  const paper = articles.find(
    (article: { contentType?: string }) => article.contentType === "paper",
  );
  if (paper) {
    await page
      .getByRole("combobox", { name: "搜索所有面板的论文" })
      .fill(paper.title);
    await expect(
      page.getByRole("option").first().locator(".search-result-meta"),
    ).toContainText("论文");
  }
  await page
    .getByRole("combobox", { name: "搜索所有面板的论文" })
    .fill("no-such-radar-paper");
  await expect(
    page.getByText("没有找到与“no-such-radar-paper”匹配的内容", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(options).toHaveCount(0);
});

test("reference motion is retained and reduced motion disables it; backdrop clicks dismiss desktop dialogs", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("./");
  const trigger = page.getByRole("button", { name: "搜索文章", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "搜索文章", exact: true });
  await expect(dialog).toHaveCSS(
    "transition-duration",
    "0.15s, 0.18s, 0.18s, 0.18s",
  );
  expect(
    await dialog.evaluate(
      (e) => getComputedStyle(e, "::backdrop").backdropFilter,
    ),
  ).toBe("blur(4px)");
  await expect(page.locator(".site-search-input")).toHaveCSS(
    "transition-duration",
    "0.18s, 0.22s, 0.22s",
  );
  if (!isMobile) {
    await page.mouse.click(8, 8);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog).toHaveCSS("transition-duration", "0s");
  await expect(page.locator(".site-search-input")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await expect(dialog).toHaveCSS("animation-name", "none");
});
