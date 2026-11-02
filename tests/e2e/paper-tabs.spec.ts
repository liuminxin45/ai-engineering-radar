import { test, expect } from "@playwright/test";

test("content tabs retain company and search, reset batches and restore URL history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./?company=tencent&page=2");
  const blog = page.getByRole("tab", { name: "博文", exact: true });
  const paper = page.getByRole("tab", { name: "论文", exact: true });
  await expect(blog).toHaveAttribute("aria-selected", "true");
  await paper.click();
  await expect(paper).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("type") === "paper" &&
      url.searchParams.get("company") === "tencent" &&
      !url.searchParams.has("page"),
  );
  await expect(
    page.getByRole("tabpanel", { name: "论文", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#company-tencent")).toHaveAttribute(
    "aria-current",
    "location",
  );
  await page.reload();
  await expect(paper).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(blog).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/page=2/);
  await page.goForward();
  await expect(paper).toHaveAttribute("aria-selected", "true");
  await paper.focus();
  await page.keyboard.press("Home");
  await expect(blog).toBeFocused();
  await expect(blog).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(paper).toBeFocused();
  await expect(paper).toHaveAttribute("aria-selected", "true");
  const search = page.getByLabel("搜索所有面板的论文", { exact: true });
  if (!(await search.isVisible()))
    await page.getByRole("button", { name: "搜索论文", exact: true }).click();
  await search.fill("no-such-joint-paper");
  await page.getByRole("button", { name: "关闭搜索", exact: true }).click();
  await expect(
    page.locator("#panel-tencent").getByText("没有匹配的论文", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "搜索论文", exact: true }),
  ).toBeHidden();
  await blog.click();
  await page.getByRole("button", { name: "搜索文章", exact: true }).click();
  await expect(
    page.getByLabel("搜索所有面板的文章", { exact: true }),
  ).toHaveValue("no-such-joint-paper");
  await page.getByRole("button", { name: "关闭搜索", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("one joint paper appears in each affiliated company and once in latest and retains metadata in detail and JSON", async ({
  page,
  request,
}) => {
  const { articles } = await (await request.get("data/articles.json")).json();
  const joint = articles.find(
    (a: { contentType?: string; companyIds?: string[] }) =>
      a.contentType === "paper" && (a.companyIds?.length ?? 0) > 1,
  );
  test.skip(
    !joint,
    "Requires a joint paper in the snapshot; CI fixtures provide one.",
  );
  await page.goto(`./?type=paper&q=${encodeURIComponent(joint.title)}`);
  const latest = page.locator("#panel-latest");
  await expect(
    latest.getByRole("link", { name: joint.title, exact: true }),
  ).toHaveCount(1);
  const { companies } = await (await request.get("data/companies.json")).json();
  for (const id of joint.companyIds) {
    await page.locator(`#company-${id}`).click();
    const list = page.locator(`#panel-${id}`);
    const article = list.locator("article").filter({
      has: page.getByRole("link", { name: joint.title, exact: true }),
    });
    await expect(article).toHaveCount(1);
    await expect(article).toBeVisible();
    await expect(article.locator("time")).toHaveCount(1);
    await expect(list.locator("article")).toHaveCount(1);
  }
  const unrelated = companies.find(
    (c: { id: string }) => !joint.companyIds.includes(c.id),
  );
  await expect(
    page
      .locator(`#panel-${unrelated.id}`)
      .getByRole("link", { name: joint.title, exact: true }),
  ).toHaveCount(0);
  for (const id of joint.companyIds) {
    await page.goto(`./?type=paper&company=${id}`);
    await expect(page.locator(`#company-${id}`)).toHaveAttribute(
      "aria-current",
      "location",
    );
    const list = page.locator(`#panel-${id}`);
    const count = articles.filter(
      (a: { contentType?: string; companyIds?: string[] }) =>
        a.contentType === "paper" && a.companyIds?.includes(id),
    ).length;
    await expect(list.locator("article")).toHaveCount(Math.min(20, count));
    if (count > 20) {
      await list.getByRole("region").evaluate((e) => {
        e.scrollTop = e.scrollHeight;
      });
      await expect(list.locator("article")).toHaveCount(Math.min(40, count));
    }
  }
  const exported = (
    await (await request.get(`data/articles/${joint.id}.json`)).json()
  ).article;
  expect(exported.companyIds).toEqual(joint.companyIds);
  await page.goto(`./articles/${joint.id}/`);
  for (const id of joint.companyIds) {
    await expect(page.locator(".article-meta")).toContainText(
      companies.find((c: { id: string }) => c.id === id).name,
    );
  }
  await page.getByRole("link", { name: "← 返回论文索引", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "论文", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
