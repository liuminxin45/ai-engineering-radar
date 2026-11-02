import { test, expect, type Page } from "@playwright/test";

const board = (page: Page) =>
  page.getByRole("main", { name: /^横向浏览公司(?:文章|论文)面板$/ });
const nav = (page: Page) =>
  page.getByRole("navigation", { name: "定位公司面板" });
const latest = (page: Page) =>
  page.getByRole("region", { name: /^最新(?:文章|论文)列表$/ });
async function left(page: Page) {
  return board(page).evaluate((e) => e.scrollLeft);
}
async function expectLeft(page: Page, value: number) {
  await expect
    .poll(async () => Math.abs((await left(page)) - value))
    .toBeLessThanOrEqual(1);
}
async function pointAtHeader(page: Page) {
  const viewport = (await board(page).boundingBox())!;
  const head = (await page.locator("#panel-latest h2").boundingBox())!;
  await page.mouse.move(
    viewport.x + viewport.width / 2,
    head.y + head.height / 2,
  );
}
async function wheelEvent(page: Page, patch: Record<string, number | boolean>) {
  return nav(page).evaluate((e, patch) => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
      ...patch,
    });
    e.dispatchEvent(event);
    return event.defaultPrevented;
  }, patch);
}

test("navigation, titles and gutters wheel horizontally without double movement or history entries", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /passive|preventDefault/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto("./");
  await expect(latest(page).locator("article").first()).toBeVisible();
  const history = await page.evaluate(() => window.history.length);
  const box = (await nav(page).boundingBox())!;
  await page.mouse.move(box.x + 90, box.y + box.height / 2);
  await page.mouse.wheel(0, 100);
  await expectLeft(page, 100);
  // A same-direction burst before the next animation frame retains both increments.
  await nav(page).evaluate((e) => {
    for (const deltaY of [100, 50])
      e.dispatchEvent(
        new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }),
      );
  });
  await expectLeft(page, 250);
  await pointAtHeader(page);
  await page.mouse.wheel(80, 0);
  await expectLeft(page, 330);
  await page.mouse.wheel(60, 20);
  await expectLeft(page, 390);
  await expect(page).toHaveURL(/company=tencent/);
  await expect(page.locator("#company-tencent")).toHaveAttribute(
    "aria-current",
    "location",
  );
  const gap = await board(page).evaluate((e) => {
    const r = e.getBoundingClientRect(),
      y = r.top + r.height * 0.5;
    for (let x = r.left + 1; x < r.right - 1; x += 2)
      if (document.elementFromPoint(x, y) === e) return { x, y };
    throw new Error("No visible board gutter");
  });
  await page.mouse.move(gap.x, gap.y);
  await page.mouse.wheel(0, 70);
  await expectLeft(page, 460);
  expect(await latest(page).evaluate((e) => e.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  // The wheel stop remains continuous instead of snapping back to a column.
  await expect
    .poll(() => board(page).evaluate((e) => getComputedStyle(e).scrollSnapType))
    .toBe("none");
  await page.getByRole("button", { name: "最新", exact: true }).click();
  await expectLeft(page, 0);
  await page.getByRole("button", { name: "腾讯", exact: true }).click();
  await expect(page).toHaveURL(/company=tencent/);
  await page.reload();
  await expect(page.locator("#company-tencent")).toHaveAttribute(
    "aria-current",
    "location",
  );
  expect(errors).toEqual([]);
});

test("wheel motion starts quickly, settles, retargets and can be interrupted", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-11-02T00:00:00Z") });
  await page.goto("./");
  await expect(latest(page).locator("article").first()).toBeVisible();
  // Let hydration and the initial URL restoration finish before freezing frames.
  await page.getByRole("button", { name: "最新", exact: true }).click();
  await expectLeft(page, 0);
  await page.clock.pauseAt(new Date("2026-11-02T01:00:00Z"));
  expect(await wheelEvent(page, { deltaY: 240 })).toBe(true);
  await expectLeft(page, 0);
  await page.clock.runFor(48);
  const first = await left(page);
  expect(first).toBeGreaterThan(110);
  expect(first).toBeLessThan(180);
  await page.clock.runFor(48);
  const second = await left(page);
  expect(second).toBeGreaterThan(first);
  expect(second - first).toBeLessThan(first);
  await page.clock.runFor(96);
  await expectLeft(page, 240);

  await wheelEvent(page, { deltaY: 400 });
  await page.clock.runFor(48);
  const continued = await left(page);
  await wheelEvent(page, { deltaY: 100 });
  await expectLeft(page, continued);
  await page.clock.runFor(192);
  await expectLeft(page, 740);

  await wheelEvent(page, { deltaY: 400 });
  await page.clock.runFor(48);
  const turning = await left(page);
  await wheelEvent(page, { deltaY: -120 });
  await expectLeft(page, turning);
  await page.clock.runFor(48);
  expect(await left(page)).toBeLessThan(turning);
  await page.clock.runFor(144);
  await expectLeft(page, turning - 120);

  await wheelEvent(page, { deltaY: 400 });
  await page.clock.runFor(48);
  await page
    .getByRole("button", { name: "搜索文章", exact: true })
    .dispatchEvent("pointerdown");
  const interrupted = await left(page);
  await page.clock.runFor(240);
  await expectLeft(page, interrupted);

  await wheelEvent(page, { deltaY: 240 });
  await page.clock.runFor(48);
  expect(await left(page)).toBeLessThan(interrupted + 240);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectLeft(page, interrupted + 240);
  await wheelEvent(page, { deltaY: 100 });
  await expectLeft(page, interrupted + 340);
  await page.clock.runFor(240);
  await expectLeft(page, interrupted + 340);
});

test("article scrolling stays vertical even at the end and horizontal trackpad input stays native", async ({
  page,
  isMobile,
}) => {
  await page.goto("./?page=1000");
  const list = latest(page);
  await expect(list.locator("article").first()).toBeVisible();
  const box = (await list.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.wheel(0, 260);
  await expect
    .poll(() => list.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(100);
  await expectLeft(page, 0);
  await list.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect
    .poll(() =>
      list.evaluate((e) =>
        Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop),
      ),
    )
    .toBeLessThanOrEqual(1);
  await page.mouse.wheel(0, 200);
  await expectLeft(page, 0);
  // A body event is not consumed, including when its list cannot scroll further.
  expect(
    await list.evaluate((e) => {
      const w = new WheelEvent("wheel", {
        deltaY: 80,
        bubbles: true,
        cancelable: true,
      });
      e.dispatchEvent(w);
      return w.defaultPrevented;
    }),
  ).toBe(false);
  if (!isMobile) {
    await page.mouse.wheel(120, 0);
    await expect.poll(() => left(page)).toBeGreaterThan(90);
  } else {
    expect(
      await board(page).evaluate((e) => getComputedStyle(e).scrollSnapType),
    ).toBe("x mandatory");
  }
});

test("edges, zoom modifiers and touch mode are preserved", async ({
  page,
  isMobile,
}) => {
  await page.goto("./");
  await expect(latest(page).locator("article").first()).toBeVisible();
  expect(await wheelEvent(page, { deltaY: -100 })).toBe(false);
  await expectLeft(page, 0);
  const maximum = await board(page).evaluate((e) => {
    const x = e.scrollWidth - e.clientWidth;
    e.scrollTo({ left: x, behavior: "instant" });
    return x;
  });
  await expectLeft(page, maximum);
  expect(await wheelEvent(page, { deltaY: 100 })).toBe(false);
  await expectLeft(page, maximum);
  expect(await wheelEvent(page, { deltaY: -100 })).toBe(true);
  await expectLeft(page, maximum - 100);
  for (const modifier of ["ctrlKey", "metaKey"]) {
    expect(await wheelEvent(page, { [modifier]: true })).toBe(false);
    await expectLeft(page, maximum - 100);
  }
  expect(
    await page.locator("header").evaluate((e) => {
      const w = new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      e.dispatchEvent(w);
      return w.defaultPrevented;
    }),
  ).toBe(false);
  await expectLeft(page, maximum - 100);
  if (isMobile) {
    expect(
      await board(page).evaluate((e) => getComputedStyle(e).scrollSnapType),
    ).toBe("none");
    await board(page).dispatchEvent("touchstart");
    expect(
      await board(page).evaluate((e) => getComputedStyle(e).scrollSnapType),
    ).toBe("x mandatory");
  }
});
