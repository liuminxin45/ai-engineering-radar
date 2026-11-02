// SPDX-License-Identifier: AGPL-3.0-only
import { test } from "node:test";
import assert from "node:assert/strict";
import { createIncrementalCsdn } from "./incremental.mjs";

test("discovery never fetches bodies; selected historic bodies use only their reviewed URL", async () => {
  const calls = [];
  const api = createIncrementalCsdn({
    accounts: new Set(["vivo_tech"]),
    request: async (path) => {
      calls.push(path);
      return {
        title: "vivo",
        item: [
          {
            title: "旧文章",
            author: "vivo_tech",
            link: "https://blog.csdn.net/vivo_tech/article/details/1",
            description: "只有摘要",
          },
        ],
      };
    },
    ofetch: async (url) => {
      calls.push(url);
      return '<nav>导航</nav><div id="content_views"><h2>正文</h2><p>完整内容</p></div>';
    },
  });
  const index = await api.index("vivo_tech");
  assert.equal(calls.length, 1);
  assert.equal(index.item[0].description, undefined);
  assert.equal(index.item[0].content, "只有摘要");
  const [body, again] = await Promise.all([
    api.body("vivo_tech", "999"),
    api.body("vivo_tech", "999"),
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "https://blog.csdn.net/vivo_tech/article/details/999");
  assert.deepEqual(body, again);
  assert.equal(body.item[0].description, "<h2>正文</h2><p>完整内容</p>");
  assert.throws(() => api.index("unknown"), /Unreviewed/);
  assert.throws(
    () => api.body("vivo_tech", "https://example.org"),
    /Unreviewed/,
  );
});
test("failed body requests are not cached and missing containers cannot become summaries", async () => {
  let attempts = 0;
  const api = createIncrementalCsdn({
    accounts: new Set(["vivo_tech"]),
    request: async () => {},
    ofetch: async () => {
      attempts++;
      if (attempts === 1) throw new Error("521");
      return attempts === 2
        ? "<p>只有导航，没有正文</p>"
        : '<div id="content_views">正文内容</div>';
    },
  });
  await assert.rejects(api.body("vivo_tech", "1"), /521/);
  await assert.rejects(api.body("vivo_tech", "1"), /container/);
  const data = await api.body("vivo_tech", "1");
  assert.equal(attempts, 3);
  assert.equal(data.item[0].description, "正文内容");
});
