import { test, expect, type Page } from "@playwright/test";

async function openLightTheme(
  page: Page,
  reducedMotion: "reduce" | "no-preference",
) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion });
  await page.addInitScript(() => {
    if (!localStorage.getItem("radar-theme"))
      localStorage.setItem("radar-theme", "light");
  });
  await page.goto("./");
  await expect(page.locator(".radar-ui")).toHaveAttribute(
    "data-preference",
    "light",
  );
}

test("theme reveals from the button and persists in both directions", async ({
  page,
}, testInfo) => {
  await openLightTheme(page, "no-preference");
  const button = page.getByRole("button", {
    name: "切换到深色外观",
    exact: true,
  });
  const bounds = await button.boundingBox();
  expect(bounds).not.toBeNull();
  await button.click();
  await expect(page.locator(".radar-ui")).toHaveAttribute(
    "data-preference",
    "dark",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reveal = document
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSAnimation &&
              animation.animationName === "theme-reveal",
          );
        if (!reveal) return false;
        reveal.pause();
        reveal.currentTime = 155;
        return true;
      }),
    )
    .toBe(true);
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      x: parseFloat(root.style.getPropertyValue("--theme-transition-x")),
      y: parseFloat(root.style.getPropertyValue("--theme-transition-y")),
      radius: parseFloat(
        root.style.getPropertyValue("--theme-transition-radius"),
      ),
      width: innerWidth,
      height: innerHeight,
    };
  });
  expect(geometry.x).toBeCloseTo(bounds!.x + bounds!.width / 2);
  expect(geometry.y).toBeCloseTo(bounds!.y + bounds!.height / 2);
  for (const [x, y] of [
    [0, 0],
    [geometry.width, 0],
    [0, geometry.height],
    [geometry.width, geometry.height],
  ]) {
    expect(geometry.radius + 0.01).toBeGreaterThanOrEqual(
      Math.hypot(x - geometry.x, y - geometry.y),
    );
  }
  await page.screenshot({ path: testInfo.outputPath("theme-reveal.png") });
  await page.evaluate(() => {
    for (const animation of document.getAnimations())
      if (
        animation instanceof CSSAnimation &&
        animation.animationName === "theme-reveal"
      )
        animation.play();
  });
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-theme-transition",
  );
  await page.reload();
  await expect(page.locator(".radar-ui")).toHaveAttribute(
    "data-preference",
    "dark",
  );
  await page
    .getByRole("button", { name: "切换到浅色外观", exact: true })
    .click();
  await expect(page.locator(".radar-ui")).toHaveAttribute(
    "data-preference",
    "light",
  );
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-theme-transition",
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("radar-theme")))
    .toBe("light");
  await page.reload();
  await expect(page.locator(".radar-ui")).toHaveAttribute(
    "data-preference",
    "light",
  );
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue(
        "--theme-transition-radius",
      ),
    ),
  ).toBe("");
});

test("reduced motion switches immediately without page or icon animation", async ({
  page,
}) => {
  await openLightTheme(page, "reduce");
  await page.evaluate(() => {
    document.startViewTransition = () => {
      document.documentElement.dataset.unexpectedTransition = "true";
      throw new Error("Reduced motion must bypass view transitions");
    };
  });
  await page
    .getByRole("button", { name: "切换到深色外观", exact: true })
    .click();
  const button = page.getByRole("button", {
    name: "切换到浅色外观",
    exact: true,
  });
  await expect(button).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-theme-transition",
  );
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-unexpected-transition",
  );
  expect(
    await button.locator("svg").evaluate((icon) => icon.getAnimations().length),
  ).toBe(0);
  await button.click();
  await expect(page.locator(".radar-ui")).toHaveAttribute(
    "data-preference",
    "light",
  );
});

test("unavailable or failed view transitions still switch and recover", async ({
  page,
}) => {
  await openLightTheme(page, "no-preference");
  for (const failure of ["unavailable", "throw", "reject"]) {
    await page.evaluate((mode) => {
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value:
          mode === "unavailable"
            ? undefined
            : () => {
                if (mode === "throw") throw new Error("Transition unavailable");
                return {
                  finished: Promise.reject(new Error("Transition rejected")),
                  skipTransition() {},
                };
              },
      });
    }, failure);
    await page
      .getByRole("button", { name: "切换到深色外观", exact: true })
      .click();
    await expect(page.locator(".radar-ui")).toHaveAttribute(
      "data-preference",
      "dark",
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme-transition",
    );
    await page
      .getByRole("button", { name: "切换到浅色外观", exact: true })
      .click();
    await expect(page.locator(".radar-ui")).toHaveAttribute(
      "data-preference",
      "light",
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme-transition",
    );
  }
});
