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

test("search and company history survive refresh while legacy sorting is removed", async ({
  page,
}) => {
  await page.goto("./");
  await expect(board(page)).toBeVisible();
  expect((await board(page).boundingBox())!.y).toBeLessThanOrEqual(132);
  await (await revealSearch(page)).fill("no-such-radar-article");
  await page.getByRole("button", { name: "关闭搜索", exact: true }).click();
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
  await page.getByRole("button", { name: "腾讯", exact: true }).click();
  await expect(page).toHaveURL(/company=tencent/);
  await page.goBack();
  await expect(page).toHaveURL(/company=dewu/);
  await page.goForward();
  await expect(page).toHaveURL(/company=tencent/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "腾讯", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await page.goto("./?sort=oldest&company=dewu");
  await expect(page).not.toHaveURL(/sort=/);
  await expect(page).toHaveURL(/company=dewu/);
  await page.locator("#company-jd").click();
  await page.reload();
  await expect(page.locator("#company-jd")).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expect(page).toHaveURL(/company=jd/);
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

test("scrolling appends one batch per bottom encounter and blog titles open the local reader", async ({
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
  for (const article of data.filter(
    (a: { contentType?: string }) => a.contentType !== "paper",
  ) as { companyId: string }[])
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
  const href = await original.getAttribute("href");
  expect(href).toMatch(/^\/ai-engineering-radar\/articles\/[a-f0-9]{20}\/$/);
  expect(await original.getAttribute("target")).toBeNull();
  await expect(original.locator(".link-label")).toHaveCount(1);
  await original.click();
  await expect(page).toHaveURL(new URL(href!, page.url()).href);
  const article = data.find((a: { id: string }) =>
    href!.includes(`/articles/${a.id}/`),
  );
  expect(article).toBeTruthy();
  await page.goto(`./articles/${article.id}/`);
  await expect(page).toHaveURL(/\/ai-engineering-radar\/articles\/[^/?]+\/?$/);
  await expect(page.locator("h1")).toHaveText(article.title);
  await expect(
    page.locator(".reader-actions").getByRole("link", { name: "阅读原文" }),
  ).toHaveAttribute("href", article.canonicalUrl);
  await expect(
    page.locator(".reader-actions").getByRole("link", { name: "阅读原文" }),
  ).toHaveAttribute("target", "_blank");
  await page.reload();
  await expect(
    page.locator(".reader-actions").getByRole("link", { name: "阅读原文" }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);
  for (const path of ["feed.xml", "feed.atom", "data/articles.json"])
    expect((await request.get(path)).ok()).toBe(true);
  await page.goto("./");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "跳转到主要内容" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "搜索文章", exact: true }),
  ).toBeVisible();
});

test("domestic provenance stays public while the interface exposes only whole-project feeds", async ({
  page,
  request,
  isMobile,
}) => {
  const companies = (await (await request.get("data/companies.json")).json())
    .companies;
  expect(companies.length).toBeGreaterThan(0);
  expect(companies.some((c: { id: string }) => c.id === "xiaomi")).toBe(false);
  expect(companies.every((c: { region: string }) => c.region === "cn")).toBe(
    true,
  );
  const sources = (await (await request.get("data/sources.json")).json())
    .sources;
  for (const id of [
    "dewu-tencent",
    "aliyun-apphub",
    "bytedance-tech-volcengine",
    "ant-data-csdn",
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
  ).toBe(0);
  for (const rule of sourceReplacements) {
    const { sourceId, replacementIds } = rule;
    expect(sources.some((s: { id: string }) => s.id === sourceId)).toBe(false);
    for (const id of replacementIds) {
      expect(sources.some((s: { id: string }) => s.id === id)).toBe(true);
      if ("referenceOnly" in rule && rule.referenceOnly) continue;
      expect(
        sources.find((s: { id: string }) => s.id === id).crawl.enabled,
      ).toBe(true);
    }
  }
  expect(sources).toHaveLength(companies.length);
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
    page.getByRole("button", { name: "ATOM/RSS", exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("button", { name: "更多选项", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await page.goto("./about/");
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

test("flat toolbar switches appearance and exposes copyable project-wide feeds", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  const root = page.locator(".radar-ui");
  const systemDark = await page.evaluate(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  await page
    .getByRole("button", {
      name: systemDark ? "切换到浅色外观" : "切换到深色外观",
      exact: true,
    })
    .click();
  await expect(root).toHaveAttribute(
    "data-preference",
    systemDark ? "light" : "dark",
  );
  if (systemDark)
    await page
      .getByRole("button", { name: "切换到深色外观", exact: true })
      .click();
  await expect(root).toHaveAttribute("data-preference", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-preference", "dark");
  await page
    .getByRole("button", { name: "切换到浅色外观", exact: true })
    .click();
  await expect(root).toHaveAttribute("data-preference", "light");
  const trigger = page.getByRole("button", { name: "ATOM/RSS", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "订阅整个项目" });
  await expect(dialog).toBeVisible();
  for (const [name, file] of [
    ["RSS", "feed.xml"],
    ["ATOM", "feed.atom"],
  ]) {
    const url = new URL(file, page.url()).href;
    await expect(
      dialog.getByRole("link", { name: url, exact: true }),
    ).toHaveAttribute("href", `/ai-engineering-radar/${file}`);
    await dialog
      .getByRole("button", { name: `复制 ${name} 链接`, exact: true })
      .click();
    await expect(dialog.getByRole("status")).toHaveText(`${name} 链接已复制`);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "关闭订阅窗口" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator("header time").click();
  await expect(dialog).toHaveCount(0);
  // A denied clipboard must remain recoverable by selecting the visible URL.
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await trigger.click();
  await dialog
    .getByRole("button", { name: "复制 RSS 链接", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(
    "无法自动复制，请选中链接手动复制。",
  );
  await page.keyboard.press("Escape");
  const github = page.getByRole("link", { name: "GitHub 项目", exact: true });
  await expect(github).toHaveAttribute(
    "href",
    "https://github.com/liuminxin45/ai-engineering-radar",
  );
  await expect(github).toHaveAttribute("target", "_blank");
  await expect(github.locator("svg")).toHaveCount(1);
  await expectNoDocumentOverflow(page);
});
