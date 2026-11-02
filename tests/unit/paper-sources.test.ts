import legacyRegistry from "../fixtures/legacy-paper-registry.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { articleSchema, type Article } from "../../packages/shared/types.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { validateRelations } from "../../packages/database/snapshot.js";
import {
  affiliationEvidence,
  parseCrossref,
  parseHuggingFacePapers,
  parseNoahPapers,
  parsePaperAuthors,
  parseReadmePapers,
  parseSeedPapers,
  scholarlyUrl,
  validatePaperSource,
} from "../../packages/crawler/platforms/papers.js";

const registry = legacyRegistry as unknown as Awaited<
  ReturnType<typeof loadRegistry>
>;
const source = registry.sources.find((s) => s.id === "dewu-papers-crossref")!;
const work = {
  DOI: "10.1145/3701716.3715218",
  type: "proceedings-article",
  title: [
    "Disentangling Scenario-wise Interest Network for Multi-scenario Recommendation",
  ],
  author: [
    {
      given: "Jin",
      family: "Huang",
      affiliation: [{ name: "Dewu, Shanghai, China" }],
    },
  ],
  published: { "date-parts": [[2025, 5, 8]] },
};
const payload = (...items: unknown[]) =>
  JSON.stringify({ status: "ok", message: { items } });

describe("publication affiliation verification", () => {
  it("accepts a publisher-deposited company affiliation and retains per-paper proof", () => {
    const [paper] = parseCrossref(payload(work), source, "dewu");
    expect(paper.companyIds).toEqual(["dewu"]);
    expect(paper.publishedAt).toBe("2025-05-08T00:00:00.000Z");
    expect(paper.paperAffiliations![0]).toMatchObject({
      companyId: "dewu",
      method: "paper-authors",
      excerpt: "Dewu, Shanghai, China",
    });
    expect(paper.paperAffiliations![0].evidenceUrl).toContain(
      "3701716.3715218",
    );
  });
  it("does not infer affiliations from titles, abstracts, author names or email domains", () => {
    const unrelated = {
      ...work,
      title: ["A Study of Dewu and Tencent"],
      abstract: "At Alibaba and Meituan",
      author: [
        {
          given: "Dewu",
          family: "Xu",
          affiliation: [
            { name: "University Laboratory, contact person@dewu.com" },
          ],
        },
      ],
    };
    expect(parseCrossref(payload(unrelated), source, "dewu")).toEqual([]);
    expect(
      parseCrossref(payload({ ...work, author: [] }), source, "dewu"),
    ).toEqual([]);
    expect(
      affiliationEvidence(
        ["Center for in vivo Imaging"],
        "https://example.org",
      ),
    ).toEqual([]);
  });
  it("rejects the unrelated Hangzhou Dewu institution, while recognizing the reviewed Shanghai company", () => {
    expect(
      affiliationEvidence(
        ["Dewu (Hangzhou) E-commerce Company, Ltd."],
        "https://example.org",
      ),
    ).toEqual([]);
    expect(
      affiliationEvidence(
        ["Shanghai Dewu Information Group Co., Ltd."],
        "https://example.org",
      ).map((p) => p.companyId),
    ).toEqual(["dewu"]);
  });
  it("keeps registered companies and excludes universities and withdrawn companies", () => {
    const papers = parseCrossref(
      payload({
        ...work,
        author: [
          {
            affiliation: [{ name: "Alibaba Group" }],
          },
          {
            affiliation: [
              { name: "Fuxi AI Lab, NetEase Inc., Hangzhou, China" },
            ],
          },
          { affiliation: [{ name: "Tsinghua University" }] },
          { affiliation: [{ name: "Xiaohongshu / Rednote 小红书" }] },
          { affiliation: [{ name: "Xiaomi / 小米" }] },
          { affiliation: [{ name: "Ctrip / Trip.com Group 携程" }] },
        ],
      }),
      source,
      "netease",
    );
    expect(new Set(papers[0].companyIds)).toEqual(
      new Set(["alibaba", "netease"]),
    );
    expect(papers[0].paperAffiliations).toHaveLength(2);
  });
  it("does not invent month/day for year-only and month-only records or publish future papers", () => {
    for (const parts of [[2025], [2025, 6]])
      expect(
        parseCrossref(
          payload({ ...work, published: { "date-parts": [parts] } }),
          source,
          "dewu",
        )[0].publishedAt,
      ).toBeUndefined();
    expect(
      parseCrossref(
        payload({ ...work, published: { "date-parts": [[2099, 1, 1]] } }),
        source,
        "dewu",
      ),
    ).toEqual([]);
  });
  it("excludes books and empty publication records and fails changed API envelopes", () => {
    expect(
      parseCrossref(payload({ ...work, type: "book" }), source, "dewu"),
    ).toEqual([]);
    expect(
      parseCrossref(payload({ ...work, title: [] }), source, "dewu"),
    ).toEqual([]);
    expect(() => parseCrossref('{"message":[]}', source, "dewu")).toThrow();
  });
  it("reads affiliations from the paper author block, excluding cited companies in body text", () => {
    const html =
      '<div class="ltx_authors"><span class="ltx_role_affiliation">Tencent, Chongqing University</span></div><p>We evaluate Tencent and Alibaba models.</p>';
    expect(
      parsePaperAuthors(html, "https://arxiv.org/html/2510.09011v3").map(
        (p) => p.companyId,
      ),
    ).toEqual(["tencent"]);
    const publisher =
      '<meta name="citation_author_institution" content="Alibaba Group"><meta name="citation_author_institution" content="NetEase Inc."><p>Tencent</p>';
    expect(
      parsePaperAuthors(publisher, "https://example.org").map(
        (p) => p.companyId,
      ),
    ).toEqual(["alibaba", "netease"]);
  });
  it("keeps the matched institution inside long evidence excerpts and removes email addresses", () => {
    const proof = affiliationEvidence(
      [`${"A ".repeat(400)} Tencent AI Lab, person@tencent.com`],
      "https://example.org",
    )[0];
    expect(proof.excerpt).toContain("Tencent AI Lab");
    expect(proof.excerpt).not.toContain("@");
    expect(proof.excerpt.length).toBeLessThanOrEqual(400);
  });
  it("excludes corporate-looking personal names from author tables and leaf name elements", () => {
    const html =
      '<div class="ltx_authors"><span class="ltx_personname"><span class="ltx_tabular"><span class="ltx_tbody"><span class="ltx_tr"><b>Jingdong Chen</b></span><span class="ltx_tr">Ant Group</span></span></span></span><span class="ltx_personname">Xiaomi Chen</span></div>';
    expect(
      parsePaperAuthors(html, "https://arxiv.org/html/2609.34605").map(
        (p) => p.companyId,
      ),
    ).toEqual(["ant"]);
    expect(
      parsePaperAuthors(
        '<div class="ltx_authors"><span class="ltx_personname">Xiaomi Chen</span></div>',
        "https://example.org",
      ),
    ).toEqual([]);
  });
});

describe("reviewed publication directories", () => {
  const hf = registry.sources.find((s) => s.id === "hunyuan-hf-papers")!;
  const org = {
    org: { name: "Tencent-Hunyuan", type: "org" },
    paperView: true,
    orgPapers: [
      {
        paper: { id: "2610.36729" },
        title: "Hy-Nomas: Towards Free-form Interactive World Generation",
        organization: { name: "Tencent-Hunyuan" },
        publishedAt: "2026-10-26T20:00:00.000Z",
      },
      {
        paper: { id: "2609.00001" },
        title: "Unrelated",
        organization: { name: "another-team" },
      },
    ],
  };
  const profile = (data: unknown, target = "OrgProfile") =>
    `<div data-target="${target}" data-props='${JSON.stringify(data)}'></div>`;
  it("checks the organization profile and every row's organization ID rather than trusting a hosted domain", () => {
    expect(parseHuggingFacePapers(profile(org), hf)).toHaveLength(1);
    expect(() =>
      parseHuggingFacePapers(
        profile({ ...org, org: { name: "fake", type: "org" } }),
        hf,
      ),
    ).toThrow();
    expect(() =>
      parseHuggingFacePapers(profile(org, "UserProfile"), hf),
    ).toThrow();
  });
  it("normalizes scholarly identities across PDF/HTML/version links without merging arbitrary websites", () => {
    for (const path of [
      "pdf/2510.09011v3.pdf",
      "html/2510.09011v2",
      "abs/2510.09011",
    ])
      expect(scholarlyUrl(`https://arxiv.org/${path}`)).toBe(
        "https://arxiv.org/abs/2510.09011",
      );
    expect(
      scholarlyUrl("https://dl.acm.org/doi/pdf/10.1145/3701716.3715218"),
    ).toBe("https://doi.org/10.1145/3701716.3715218");
    expect(
      scholarlyUrl("https://arxiv.org.evil.test/abs/2510.09011"),
    ).toBeUndefined();
    expect(scholarlyUrl("javascript:alert(1)")).toBeUndefined();
  });
  it("ignores README references and deduplicates repeated badges before checking paper authors", () => {
    const text =
      "[Paper](https://arxiv.org/abs/2510.09011) https://arxiv.org/pdf/2510.09011v3.pdf\n## References\nhttps://arxiv.org/abs/2009.03300";
    expect(parseReadmePapers(text).map((p) => p.url)).toEqual([
      "https://arxiv.org/abs/2510.09011",
    ]);
  });
  it("does not execute Seed script data and excludes non-paper rows", () => {
    const seed = registry.sources.find((s) => s.id === "seed-official-papers")!;
    const article = {
      ArticleMeta: {
        Author: "ByteDance Seed",
        ArticleType: 1,
        ArticleID: 1,
        PublishDate: 1788264000000,
        ExternalLinks: [
          { ExternalLinkType: 1, Link: "https://arxiv.org/pdf/2609.01437" },
        ],
      },
      ArticleSubContentEn: {
        Title: "HarnessDev",
        Abstract: "Short directory excerpt",
      },
    };
    const data = {
      loaderData: {
        "(locale$)/public_papers/page": {
          article_list: [
            article,
            {
              ...article,
              ArticleMeta: { ...article.ArticleMeta, ArticleType: 0 },
            },
          ],
        },
      },
    };
    const papers = parseSeedPapers(
      `<script>window._ROUTER_DATA = ${JSON.stringify(data)}</script>`,
      seed,
      "bytedance",
    );
    expect(papers).toHaveLength(1);
    expect(papers[0].paperAffiliations![0].method).toBe("official-directory");
    expect(() =>
      parseSeedPapers(
        '<script>window._ROUTER_DATA = (()=>{throw new Error("executed")})()</script>',
        seed,
        "bytedance",
      ),
    ).toThrow();
  });
  it("does not confuse Noah directory upload dates with scientific publication dates", () => {
    const noah = registry.sources.find((s) => s.id === "noah-official-papers")!;
    const data = [
      { id: 1, resources_title: 2, link: 3, publication_date: 4 },
      144,
      "SAMformer",
      "https://arxiv.org/abs/2402.10198",
      "2026-02-10T17:45:00+08:00",
    ];
    const papers = parseNoahPapers(
      `<script id="__NUXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`,
      noah,
      "huawei",
    );
    expect(papers).toHaveLength(1);
    expect(papers[0].publishedAt).toBeUndefined();
  });
  it("rejects unbounded or mismatched collection endpoints", () => {
    expect(() =>
      validatePaperSource({
        ...source,
        url: source.url.replace("rows=100", "rows=1000"),
      }),
    ).toThrow();
    expect(() =>
      validatePaperSource({ ...hf, authorAllowlist: ["fake"] }),
    ).toThrow();
    expect(() => validatePaperSource({ ...hf, contentType: "blog" })).toThrow();
  });
});

describe("joint-paper identity and provenance", () => {
  it("merges one DOI across company sources and preserves all source relations and evidence", () => {
    const articles: Article[] = [];
    const tencent = registry.sources.find(
      (s) => s.id === "tencent-papers-crossref",
    )!;
    const joint = {
      ...work,
      author: [
        {
          affiliation: [
            { name: "Dewu, Shanghai, China" },
            { name: "Tencent AI Lab" },
          ],
        },
      ],
    };
    const first = upsert(
      articles,
      parseCrossref(payload(joint), source, "dewu")[0],
      source,
      registry,
    );
    upsert(
      articles,
      parseCrossref(payload(joint), tencent, "tencent")[0],
      tencent,
      registry,
    );
    expect(articles).toHaveLength(1);
    expect(first.locations).toHaveLength(2);
    expect(first.paperAffiliations).toHaveLength(2);
    expect(first.companyIds).toEqual(["dewu", "tencent"]);
    validateRelations(articles, [], registry);
    expect(() =>
      validateRelations(
        [
          {
            ...first,
            companyIds: ["dewu"],
            paperAffiliations: first.paperAffiliations!.filter(
              (p) => p.companyId === "dewu",
            ),
          },
        ],
        [],
        registry,
      ),
    ).toThrow(/source relation/);
  });
  it("requires affiliation evidence to match every declared company when evidence is present", () => {
    const a = upsert(
      [],
      parseCrossref(payload(work), source, "dewu")[0],
      source,
      registry,
    );
    expect(() =>
      articleSchema.parse({ ...a, companyIds: ["dewu", "tencent"] }),
    ).toThrow();
    expect(() =>
      articleSchema.parse({ ...a, contentType: "blog", companyIds: undefined }),
    ).toThrow();
  });
});
