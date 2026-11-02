import { load } from "cheerio";
import type {
  Article,
  Candidate,
  PaperAffiliation,
  Source,
  SourceState,
} from "../../shared/types.js";
import { fetchReviewed, CrawlError, type HttpResult } from "../http.js";

const clean = (s: unknown, max = 600) =>
  load(`<body>${String(s ?? "")}</body>`)
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
// Match author institutions only. Product mentions, experiments and reference lists are not affiliation evidence.
const institutions: Record<string, RegExp> = {
  dewu: /(?:^Dewu(?:,|$)|Shanghai Dewu|Dewu Information|Shanghai Shizhuang|得物|上海识装)/i,
  alibaba:
    /\bAlibaba\b|\bDAMO Academy\b|\bTongyi (?:Lab|Laboratory)\b|阿里巴巴|阿里云/i,
  tencent: /\bTencent\b|腾讯/i,
  bytedance: /\bByteDance\b|字节跳动/i,
  meituan: /\bMeituan\b|美团/i,
  vivo: /(?:^vivo$|\bvivo (?:Mobile|Communication|AI Lab|Camera Research|Research)|维沃)/i,
  huawei: /\bHuawei\b|华为/i,
  kuaishou: /\bKuaishou\b|快手/i,
  netease: /\bNetEase\b|网易/i,
  bilibili: /\bBilibili\b|哔哩哔哩/i,
  jd: /\bJD\.com\b|\bJD (?:AI|Explore|Research|Cloud|Technology|Logistics|Financial)\b|\bJingdong (?:Technology|Logistics|Group|Inc|Company|Ltd)\b|京东/i,
  baidu: /\bBaidu\b|百度/i,
  ant: /\bAnt (?:Group|Research|Financial)\b|\bAntGroup\b|蚂蚁(?:集团|金服)/i,
};
export function affiliationEvidence(
  values: string[],
  evidenceUrl: string,
): PaperAffiliation[] {
  values = values.map((v) =>
    v.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ""),
  );
  return Object.entries(institutions).flatMap(([companyId, pattern]) => {
    const affiliation = values.find((v) => pattern.test(v));
    const index = affiliation?.search(pattern) ?? 0;
    return affiliation
      ? [
          {
            companyId,
            evidenceUrl,
            method: "paper-authors" as const,
            excerpt: clean(
              affiliation.slice(Math.max(0, index - 70), index + 330),
              400,
            ),
          },
        ]
      : [];
  });
}
export function scholarlyUrl(input: string): string | undefined {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return;
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    return;
  const arxiv =
    /^(?:\/(?:abs|pdf|html)\/)(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?\/?$/.exec(
      u.pathname,
    );
  if (
    ["arxiv.org", "www.arxiv.org", "export.arxiv.org"].includes(u.hostname) &&
    arxiv
  )
    return `https://arxiv.org/abs/${arxiv[1]}`;
  if (
    ["doi.org", "dx.doi.org"].includes(u.hostname) &&
    /^\/10\.\d{4,9}\/\S+$/i.test(u.pathname)
  )
    return `https://doi.org${u.pathname.toLowerCase()}`;
  const acm = /^\/doi\/(?:abs\/|pdf\/)?(10\.\d{4,9}\/.+)$/.exec(u.pathname);
  if (u.hostname === "dl.acm.org" && acm)
    return `https://doi.org/${acm[1].toLowerCase()}`;
  if (
    u.hostname === "openreview.net" &&
    ["/forum", "/pdf", "/attachment"].includes(u.pathname) &&
    u.searchParams.get("id")
  )
    return `https://openreview.net/forum?id=${encodeURIComponent(u.searchParams.get("id")!)}`;
  if (
    u.hostname === "aclanthology.org" &&
    /^\/[a-zA-Z0-9.-]+\/?$/.test(u.pathname)
  )
    return `https://aclanthology.org/${u.pathname.replace(/^\/|\/$|\.pdf$/g, "")}/`;
  if (
    [
      "www.ijcai.org",
      "proceedings.mlr.press",
      "proceedings.neurips.cc",
      "www.nature.com",
      "ieeexplore.ieee.org",
    ].includes(u.hostname)
  ) {
    if (u.hostname === "ieeexplore.ieee.org") {
      const id =
        u.pathname.match(/^\/document\/(\d+)/)?.[1] ??
        u.searchParams.get("arnumber");
      if (!id || !/^\d+$/.test(id)) return;
      return `https://ieeexplore.ieee.org/document/${id}`;
    }
    u.protocol = "https:";
    u.hash = "";
    u.search = "";
    return u.href;
  }
}
const timestamp = (s: unknown) => {
  if (!s) return;
  const d = new Date(String(s));
  return Number.isFinite(+d) &&
    d.getUTCFullYear() >= 1990 &&
    +d <= Date.now() + 86400000
    ? d.toISOString()
    : undefined;
};
function crossrefDate(item: any): string | undefined {
  const parts = (item.published ??
    item["published-online"] ??
    item["published-print"])?.["date-parts"]?.[0];
  if (
    !Array.isArray(parts) ||
    parts.length !== 3 ||
    !parts.every(Number.isInteger)
  )
    return;
  const [y, m, d] = parts;
  const value = new Date(Date.UTC(y, m - 1, d));
  if (
    value.getUTCFullYear() !== y ||
    value.getUTCMonth() !== m - 1 ||
    value.getUTCDate() !== d
  )
    return;
  return timestamp(value.toISOString());
}
export function parseCrossref(
  text: string,
  source: Source,
  companyId: string,
): Candidate[] {
  const data = JSON.parse(text);
  if (
    data.status !== "ok" ||
    !data.message ||
    !Array.isArray(data.message.items)
  )
    throw new CrawlError("Crossref work-list schema changed");
  return data.message.items.flatMap((work: any) => {
    if (
      !["journal-article", "proceedings-article", "posted-content"].includes(
        work.type,
      )
    )
      return [];
    const url = scholarlyUrl(`https://doi.org/${work.DOI}`);
    const title = clean(work.title?.[0]);
    if (!url || !title) return [];
    const evidenceUrl = `https://api.crossref.org/works/${encodeURIComponent(work.DOI)}`;
    const values = (work.author ?? []).flatMap((a: any) =>
      (a.affiliation ?? []).map((v: any) => clean(v.name, 1600)),
    );
    const paperAffiliations = affiliationEvidence(values, evidenceUrl);
    if (!paperAffiliations.some((p) => p.companyId === companyId)) return [];
    const year = work.published?.["date-parts"]?.[0]?.[0];
    if (typeof year === "number" && year > new Date().getUTCFullYear())
      return [];
    const parts = work.published?.["date-parts"]?.[0];
    if (
      parts?.length === 3 &&
      new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getTime() >
        Date.now() + 86400000
    )
      return [];
    return [
      {
        contentType: "paper" as const,
        companyIds: paperAffiliations.map((p) => p.companyId),
        paperAffiliations,
        title,
        url,
        canonicalUrl: url,
        externalId: work.DOI.toLowerCase(),
        author:
          clean(
            (work.author ?? [])
              .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
              .join(", "),
            300,
          ) || undefined,
        description: work.abstract ? clean(work.abstract, 800) : undefined,
        publishedAt: crossrefDate(work),
        language: work.language || undefined,
      },
    ];
  });
}
export function parsePaperAuthors(
  html: string,
  evidenceUrl: string,
): PaperAffiliation[] {
  const $ = load(html);
  const values = $('meta[name="citation_author_institution"]')
    .map((_, e) => $(e).attr("content") ?? "")
    .get();
  if (!values.length)
    $(".ltx_authors").each((_, e) => {
      const block = $(e).clone();
      const explicit = block.find(
        ".ltx_role_affiliation, .ltx_affiliation, [itemprop='affiliation']",
      );
      explicit.each((_, node) => {
        values.push($(node).text());
      });
      if (explicit.length) return;
      block.find(".ltx_role_thanks, a[href^='mailto:'], .ltx_email").remove();
      const names = block.find(".ltx_personname");
      const corporateTeam =
        /^(?:(?:Xiaomi|Tencent|ByteDance|Meituan|Baidu|Alibaba|NetEase|Kuaishou|OPPO|Ant|vivo)[\w\s.-]*(?:Team|Lab|Laboratory|Research|Group))\s*$/i;
      if (
        !names.length &&
        !/Affiliation:/i.test(block.text()) &&
        !corporateTeam.test(block.text().trim())
      )
        return;
      names.each((_, person) => {
        const node = $(person);
        if (node.find(".ltx_tabular").length) {
          node.find(".ltx_tbody").each((_, body) => {
            $(body).children(".ltx_tr").first().remove();
          });
        } else if (node.find("br").length) {
          node.html(
            (node.html() ?? "")
              .split(/<br\s*\/?\s*>/i)
              .slice(1)
              .join("<br>"),
          );
        } else if (!corporateTeam.test(node.text().trim())) {
          node.find(".ltx_author_notes").each((_, note) => {
            values.push($(note).text());
          });
          node.remove();
        }
      });
      values.push(block.text());
    });
  return affiliationEvidence(values, evidenceUrl);
}
export function parseHuggingFacePapers(
  html: string,
  source: Source,
): Candidate[] {
  const $ = load(html),
    element = $('[data-target="OrgProfile"][data-props]');
  if (element.length !== 1)
    throw new CrawlError("Not a Hugging Face organization publication profile");
  const data = JSON.parse(element.attr("data-props")!);
  const account = source.authorAllowlist![0];
  if (
    data.org?.type !== "org" ||
    data.org?.name !== account ||
    data.paperView !== true ||
    !Array.isArray(data.orgPapers)
  )
    throw new CrawlError("Publication organization identity changed");
  return data.orgPapers.flatMap((row: any) => {
    if (
      row.organization?.name !== account ||
      typeof row.paper?.id !== "string" ||
      !/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(row.paper.id)
    )
      return [];
    const url = scholarlyUrl(`https://arxiv.org/abs/${row.paper.id}`);
    const title = clean(row.title);
    return url && title
      ? [
          {
            contentType: "paper" as const,
            title,
            url,
            canonicalUrl: url,
            externalId: row.paper.id.replace(/v\d+$/, ""),
            publishedAt: timestamp(row.publishedAt),
          },
        ]
      : [];
  });
}
function directoryPaper(
  item: Candidate,
  source: Source,
  companyId: string,
): Candidate {
  return {
    ...item,
    contentType: "paper",
    companyIds: [companyId],
    paperAffiliations: [
      {
        companyId,
        evidenceUrl: source.entryUrl,
        method: "official-directory",
        excerpt: `${source.name}：${item.title}`.slice(0, 400),
      },
    ],
  };
}
export function parseSeedPapers(
  html: string,
  source: Source,
  companyId: string,
): Candidate[] {
  const $ = load(html);
  const raw = $("script")
    .map((_, e) => $(e).text())
    .get()
    .find((s) => /^window\._ROUTER_DATA\s*=/.test(s));
  if (!raw) throw new CrawlError("Seed publication server data unavailable");
  const data = JSON.parse(
    raw.replace(/^window\._ROUTER_DATA\s*=\s*/, "").replace(/;\s*$/, ""),
  );
  const list = data.loaderData?.["(locale$)/public_papers/page"]?.article_list;
  if (!Array.isArray(list))
    throw new CrawlError("Seed publication list schema changed");
  return list.flatMap((row: any) => {
    const meta = row.ArticleMeta,
      content = row.ArticleSubContentEn;
    if (meta?.ArticleType !== 1 || !content?.Title) return [];
    const link = meta.ExternalLinks?.find(
      (l: any) => l.ExternalLinkType === 1,
    )?.Link;
    if (typeof link !== "string") return [];
    const url =
      scholarlyUrl(link) ??
      (/^https:\/\/lf3-static\.bytednsdoc\.com\/.+\.pdf$/.test(link)
        ? link
        : undefined);
    if (!url) return [];
    return [
      directoryPaper(
        {
          title: clean(content.Title),
          url,
          canonicalUrl: url,
          externalId: String(meta.ArticleID),
          description: clean(content.Abstract, 800) || undefined,
          publishedAt: timestamp(new Date(meta.PublishDate).toISOString()),
        },
        source,
        companyId,
      ),
    ];
  });
}
export function parseNoahPapers(
  html: string,
  source: Source,
  companyId: string,
): Candidate[] {
  const $ = load(html),
    raw = $("#__NUXT_DATA__").text();
  if (!raw) throw new CrawlError("Noah publication server data unavailable");
  const data = JSON.parse(raw);
  if (!Array.isArray(data))
    throw new CrawlError("Noah serialized publication schema changed");
  return data.flatMap((row: any) => {
    if (
      !row ||
      typeof row !== "object" ||
      !Number.isInteger(row.resources_title) ||
      !Number.isInteger(row.link)
    )
      return [];
    const title = data[row.resources_title],
      link = data[row.link];
    if (typeof title !== "string" || typeof link !== "string") return [];
    const url = scholarlyUrl(link);
    if (!url) return [];
    // publication_date is the directory upload time, which may differ from the paper's publication year.
    return [
      directoryPaper(
        {
          title: clean(title),
          url,
          canonicalUrl: url,
          externalId: String(data[row.id]),
        },
        source,
        companyId,
      ),
    ];
  });
}
export function parseReadmePapers(text: string): Candidate[] {
  const header = text
    .split(/^#{1,6}\s*(?:References|Related Work|Acknowledg)/im)[0]
    .slice(0, 20000);
  const urls = [
    ...header.matchAll(
      /https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/\d{4}\.\d{4,5}(?:v\d+)?(?:\.pdf)?/g,
    ),
  ].map((m) => scholarlyUrl(m[0])!);
  return [...new Set(urls)].map((url) => ({
    title: "",
    url,
    canonicalUrl: url,
    externalId: url.split("/").at(-1)!,
  }));
}
export function paperPageMetadata(
  html: string,
  url: string,
): Partial<Candidate> {
  const $ = load(html);
  const meta = (name: string) => $(`meta[name="${name}"]`).attr("content");
  const title =
    meta("citation_title") ?? $(".ltx_title_document").first().text() ?? "";
  const authors = $('meta[name="citation_author"]')
    .map((_, e) => $(e).attr("content") ?? "")
    .get();
  if (!authors.length)
    $(".ltx_authors .ltx_personname").each((_, e) => {
      authors.push($(e).text());
    });
  return {
    title: clean(title) || undefined,
    author: clean(authors.join(", "), 300) || undefined,
    publishedAt: timestamp(
      meta("citation_date") ?? meta("citation_publication_date"),
    ),
    canonicalUrl:
      scholarlyUrl(
        meta("citation_doi") ? `https://doi.org/${meta("citation_doi")}` : url,
      ) ?? url,
  };
}
const arxivMetadata = new Map<
  string,
  Promise<{ metadata: Partial<Candidate>; affiliations: PaperAffiliation[] }>
>();
async function verifiedArxiv(
  item: Candidate,
  source: Source,
  context: PaperContext,
): Promise<Candidate | undefined> {
  const canonical = scholarlyUrl(item.url)!;
  const known = context.articles.find(
    (a) =>
      a.contentType === "paper" &&
      a.publicationStatus === "published" &&
      a.canonicalUrl === canonical &&
      a.paperAffiliations?.some(
        (p) =>
          p.companyId === context.companyId && p.method === "paper-authors",
      ),
  );
  if (known)
    return {
      ...item,
      title: item.title || known.title,
      author: known.author,
      publishedAt: item.publishedAt ?? known.publishedAt,
      companyIds: known.companyIds,
      paperAffiliations: known.paperAffiliations,
      contentType: "paper",
    };
  if (!arxivMetadata.has(canonical))
    arxivMetadata.set(
      canonical,
      (async () => {
        const htmlUrl = canonical.replace("/abs/", "/html/");
        const page = await fetchReviewed(htmlUrl, source);
        const affiliations = parsePaperAuthors(page.text, page.url);
        let metadata = paperPageMetadata(page.text, canonical);
        if (!metadata.publishedAt && !item.publishedAt && affiliations.length) {
          try {
            metadata = {
              ...metadata,
              ...paperPageMetadata(
                (await fetchReviewed(canonical, source)).text,
                canonical,
              ),
            };
          } catch {
            /* The author signature remains usable when optional date metadata is unavailable. */
          }
        }
        return { metadata, affiliations };
      })(),
    );
  const { metadata, affiliations } = await arxivMetadata.get(canonical)!;
  if (!affiliations.some((p) => p.companyId === context.companyId)) return;
  return {
    ...item,
    ...metadata,
    title: metadata.title || item.title,
    publishedAt: metadata.publishedAt ?? item.publishedAt,
    contentType: "paper",
    companyIds: affiliations.map((p) => p.companyId),
    paperAffiliations: affiliations,
  };
}
export function validatePaperSource(source: Source) {
  if (!source.platform.startsWith("paper-")) return;
  const u = new URL(source.url);
  if (
    source.contentType !== "paper" ||
    source.adapter !== "html" ||
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash
  )
    throw new Error(`Invalid paper source ${source.id}`);
  const account = source.authorAllowlist?.[0];
  if (source.authorAllowlist?.length !== 1 || !account)
    throw new Error(
      `Paper source needs one reviewed account or affiliation query: ${source.id}`,
    );
  if (
    ["paper-huggingface", "paper-readme"].includes(source.platform) &&
    !source.linkHosts?.includes("arxiv.org")
  )
    throw new Error(
      `Paper author verification requires the reviewed arXiv host: ${source.id}`,
    );
  const valid =
    source.platform === "paper-crossref"
      ? u.origin === "https://api.crossref.org" &&
        u.pathname === "/works" &&
        u.searchParams.get("query.affiliation") === account &&
        Number(u.searchParams.get("rows")) <= 100 &&
        Number(u.searchParams.get("rows")) > 0
      : source.platform === "paper-huggingface"
        ? u.origin === "https://huggingface.co" &&
          u.pathname === `/${account}/papers` &&
          !u.search
        : source.platform === "paper-seed"
          ? u.href === "https://seed.bytedance.com/en/public_papers" &&
            account === "ByteDance Seed"
          : source.platform === "paper-noah"
            ? u.href === "https://www.noahlab.com.hk/en/research_paper" &&
              account === "Huawei Noah"
            : source.platform === "paper-readme"
              ? u.origin === "https://raw.githubusercontent.com" &&
                u.pathname.startsWith(`/${account}/`) &&
                /\/README(?:_[a-z]+)?\.md$/.test(u.pathname) &&
                !u.search
              : source.platform === "paper-metadata"
                ? ["arxiv.org", "ojs.aaai.org"].includes(u.hostname) &&
                  !u.search
                : false;
  if (!valid)
    throw new Error(
      `Paper source does not match its reviewed endpoint: ${source.id}`,
    );
}

export type PaperContext = { companyId: string; articles: Article[] };
// More publication parsers are kept behind this dispatcher; generic blog adapters never classify papers by keywords.
export async function collectPapers(
  source: Source,
  state: SourceState,
  limit: number,
  context: PaperContext,
) {
  validatePaperSource(source);
  const headers: Record<string, string> = {};
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;
  const response = await fetchReviewed(source.url, source, headers);
  if (response.status === 304)
    return { items: [], response, warnings: [] as string[] };
  let items: Candidate[];
  const warnings: string[] = [];
  if (source.platform === "paper-crossref")
    items = parseCrossref(response.text, source, context.companyId);
  else if (source.platform === "paper-seed")
    items = parseSeedPapers(response.text, source, context.companyId);
  else if (source.platform === "paper-noah")
    items = parseNoahPapers(response.text, source, context.companyId);
  else if (source.platform === "paper-metadata") {
    const proofs = parsePaperAuthors(response.text, source.url);
    const metadata = paperPageMetadata(response.text, source.url);
    items =
      proofs.some((p) => p.companyId === context.companyId) && metadata.title
        ? [
            {
              ...metadata,
              title: metadata.title,
              url: metadata.canonicalUrl ?? source.url,
              contentType: "paper",
              companyIds: proofs.map((p) => p.companyId),
              paperAffiliations: proofs,
            },
          ]
        : [];
  } else if (["paper-huggingface", "paper-readme"].includes(source.platform)) {
    const candidates =
      source.platform === "paper-huggingface"
        ? parseHuggingFacePapers(response.text, source)
        : parseReadmePapers(response.text);
    items = [];
    for (const candidate of candidates.slice(0, limit)) {
      try {
        const verified = await verifiedArxiv(candidate, source, context);
        if (verified?.title) items.push(verified);
        else
          warnings.push(
            `Unconfirmed company affiliation: ${candidate.externalId}`,
          );
      } catch {
        warnings.push(
          `Paper author metadata unavailable: ${candidate.externalId}`,
        );
      }
    }
  } else throw new CrawlError("Unsupported publication parser");
  const unique = [
    ...new Map(items.map((a) => [a.canonicalUrl ?? a.url, a])).values(),
  ].sort(
    (a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
      a.title.localeCompare(b.title),
  );
  if (!unique.length)
    throw new CrawlError("No papers with verified company affiliations found");
  return { items: unique.slice(0, limit), response, warnings };
}
