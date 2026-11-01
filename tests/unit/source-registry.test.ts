import { describe, expect, it } from "vitest";
import {
  loadRegistry,
  validateAccountScope,
} from "../../packages/source-registry/index.js";

describe("official community account scope", () => {
  it("accepts separately reviewed Aliyun publishers and the exact Volcengine account", async () => {
    const registry = await loadRegistry();
    const cloud = registry.sources.find((s) => s.id === "aliyun-cloud-native")!;
    const dataphin = registry.sources.find((s) => s.id === "aliyun-dataphin")!;
    const volc = registry.sources.find((s) => s.id === "bytedance-volcengine")!;
    expect(cloud.publisherId).not.toBe(dataphin.publisherId);
    for (const source of [cloud, dataphin, volc])
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
      (s) => s.id === "bytedance-volcengine",
    )!;
    expect(() =>
      validateAccountScope({
        ...source,
        authorAllowlist: ["2772312065061673"],
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
        url: "https://developer.volcengine.com/user/1333053764416295?tab=all",
      }),
    ).toThrow();
  });
});
