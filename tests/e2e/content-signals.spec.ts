import { test, expect } from "@playwright/test";

test("activity filtering is opt-in, shareable and reversible", async ({
  page,
}) => {
  await page.goto("./");
  const toggle = page.getByRole("checkbox", { name: "隐藏活动／福利" });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page).toHaveURL(/hide=activities/);
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page).not.toHaveURL(/hide=activities/);
  await page.goBack();
  await expect(toggle).toBeChecked();
});

test("list labels lead to visible metadata evidence rather than admission claims", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("link", { name: /查看标题摘要规则依据/ })
    .first()
    .click();
  const review = page.locator("#content-signals");
  await review.locator("summary").click();
  await expect(review).toContainText("仅依据标题和摘要，未审核全文");
  await expect(review).toContainText("待判断不代表不相关");
});
