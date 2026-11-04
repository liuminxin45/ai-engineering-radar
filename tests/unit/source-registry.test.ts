import { aliyunFixture } from "../fixtures/aliyun-source.js";
import { describe, expect, it } from "vitest";
import {
  loadRegistry,
  validateAccountScope,
  validateCompanySources,
} from "../../packages/source-registry/index.js";

describe("official community account scope", () => {
  it("keeps only enabled verified collectors and requires a blog for every company", async () => {
    const registry = await loadRegistry();
    expect(registry.companies.some((c) => c.id === "xiaohongshu")).toBe(false);
    expect(() => validateCompanySources(registry)).not.toThrow();
    expect(
      registry.sources.every(
        (s) =>
          s.crawl.enabled &&
          s.verification.status === "verified" &&
          s.adapter !== "reference",
      ),
    ).toBe(true);
    for (const companyId of ["alibaba"]) {
      const publishers = new Set(
        registry.publishers
          .filter((p) => p.companyId === companyId)
          .map((p) => p.id),
      );
      const sources = registry.sources.filter((s) =>
        publishers.has(s.publisherId),
      );
      expect(sources.length).toBeGreaterThan(0);
      expect(
        sources.filter((s) => s.contentType !== "paper").map((s) => s.id),
      ).toEqual(["aliyun-apphub"]);
      const paperOnly = {
        ...registry,
        sources: registry.sources.filter((s) => s.id !== "aliyun-apphub"),
      };
      expect(() => validateCompanySources(paperOnly)).toThrow(
        "Company must have a collectable source",
      );
    }
    const source = registry.sources.find((s) => s.id === "meituan")!;
    const duplicate = structuredClone(registry);
    duplicate.sources.push({ ...source, id: "another-blog" });
    expect(() => validateCompanySources(duplicate)).toThrow(
      "at most one blog source",
    );
    const disabled = structuredClone(registry);
    disabled.sources[0].crawl.enabled = false;
    expect(() => validateCompanySources(disabled)).toThrow(
      "non-collectable source",
    );
    const owners = new Set(
      registry.publishers
        .filter((p) => p.companyId === "meituan")
        .map((p) => p.id),
    );
    const noCompanySources = {
      ...registry,
      sources: registry.sources.filter((s) => !owners.has(s.publisherId)),
    };
    expect(() => validateCompanySources(noCompanySources)).toThrow(
      "Company must have a collectable source",
    );
  });
  it("accepts the historical Aliyun parser fixture and reviewed Toutiao account", async () => {
    const registry = await loadRegistry();
    const cloud = aliyunFixture;
    const volc = registry.sources.find(
      (s) => s.id === "bytedance-tech-toutiao",
    )!;
    for (const source of [cloud, volc])
      expect(() => validateAccountScope(source)).not.toThrow();
  });

  it("rejects an Aliyun homepage, a third party host and missing reviewed profiles", async () => {
    const source = aliyunFixture;
    for (const patch of [
      { url: "https://developer.aliyun.com/" },
      { url: "https://other.example/group/apphub/article/" },
      { authorAllowlist: [] },
      { authorAllowlist: ["阿里云云原生"] },
      { url: "https://developer.aliyun.com/group/apphub/article/?author=any" },
    ])
      expect(() => validateAccountScope({ ...source, ...patch })).toThrow();
  });

  it("rejects a Toutiao account whose stable token differs from the directory", async () => {
    const source = (await loadRegistry()).sources.find(
      (s) => s.id === "bytedance-tech-toutiao",
    )!;
    expect(() =>
      validateAccountScope({
        ...source,
        authorAllowlist: ["1333053764416295"],
      }),
    ).toThrow();
    expect(() =>
      validateAccountScope({
        ...source,
        url: "https://developer.volcengine.com/",
      }),
    ).toThrow();
    expect(() =>
      validateAccountScope({
        ...source,
        url: "https://developer.volcengine.com/user/2772312065061673?tab=all",
      }),
    ).toThrow();
  });
});
