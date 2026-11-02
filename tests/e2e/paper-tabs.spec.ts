import { test, expect } from "@playwright/test";
test("legacy paper links show blogs and public data contains only blogs", async ({
  page,
  request,
}) => {
  await page.goto("./?type=paper");
  await expect(
    page.getByRole("button", { name: "搜索文章", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "论文", exact: true }),
  ).toHaveCount(0);
  for (const path of ["data/articles.json", "data/sources.json"]) {
    const data = await (await request.get(path)).json();
    const records = data.articles ?? data.sources ?? data;
    expect(records.length).toBeGreaterThan(0);
    expect(
      records.some(
        (item: { contentType?: string }) => item.contentType === "paper",
      ),
    ).toBe(false);
  }
});
