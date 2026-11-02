import { describe, expect, it } from "vitest";
import {
  loadRegistry,
  validateAccountScope,
  validateCompanySources,
} from "../../packages/source-registry/index.js";

describe("official community account scope", () => {
  it("requires exactly one blog source per company, including disabled blog references and other publishers", async () => {
    const registry = await loadRegistry();
    expect(() => validateCompanySources(registry)).not.toThrow();
    const source = registry.sources.find(
      (s) => s.id === "aliyun-cloud-native",
    )!;
    const duplicate = structuredClone(registry);
    duplicate.publishers.push({
      id: "another-team",
      companyId: "alibaba",
      name: "Another team",
    });
    duplicate.sources.push({
      ...source,
      id: "another-source",
      publisherId: "another-team",
      adapter: "reference",
      crawl: { ...source.crawl, enabled: false },
    });
    expect(() => validateCompanySources(duplicate)).toThrow(
      "exactly one source: alibaba (found 2)",
    );
    expect(() =>
      validateCompanySources({
        ...registry,
        sources: registry.sources.filter((s) => s.id !== source.id),
      }),
    ).toThrow("found 0");
    expect(
      registry.sources.filter((s) => s.verification.status === "suspended"),
    ).toHaveLength(2);
  });
  it("accepts the retained Aliyun and Volcengine accounts", async () => {
    const registry = await loadRegistry();
    const cloud = registry.sources.find((s) => s.id === "aliyun-cloud-native")!;
    const volc = registry.sources.find(
      (s) => s.id === "bytedance-tech-volcengine",
    )!;
    for (const source of [cloud, volc])
      expect(() => validateAccountScope(source)).not.toThrow();
  });

  it("rejects an Aliyun homepage, a third party host and missing reviewed profiles", async () => {
    const source = (await loadRegistry()).sources.find(
      (s) => s.id === "aliyun-cloud-native",
    )!;
    for (const patch of [
      { url: "https://developer.aliyun.com/" },
      { url: "https://other.example/group/apphub/article/" },
      { authorAllowlist: [] },
      { authorAllowlist: ["阿里云云原生"] },
      { url: "https://developer.aliyun.com/group/apphub/article/?author=any" },
    ])
      expect(() => validateAccountScope({ ...source, ...patch })).toThrow();
  });

  it("rejects a Volcengine account whose stable ID differs from the directory", async () => {
    const source = (await loadRegistry()).sources.find(
      (s) => s.id === "bytedance-tech-volcengine",
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
