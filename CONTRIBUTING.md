# 贡献指南 / Contributing

## 可以贡献什么

欢迎提交 PR，适配国内官方来源、修复解析器、补充官方身份材料，或更正文章归属与元数据。首批仅接入国内公司官方技术团队，暂不接受海外来源接入。

国内公司自有技术站和第三方博客社区中的国内公司官方团队账号都在范围内，例如博客园、腾讯云开发者社区和阿里云开发者社区。已核验且启用的官方来源文章直接建立索引，保留身份核验、去重与数据校验，不做内容筛选或自动主题分类。

来源提议不要求你先完成全部开发。可以用[来源提议模板](https://github.com/liuminxin45/ai-engineering-radar/issues/new?template=source.yml)提供线索，并标明尚未确认的事项。已有来源处于待核验或访问受限状态时，也欢迎补充证据或允许采集的替代入口。

## 准备来源材料

每个来源需要说明以下信息。PR 中保留公开证据的 URL、核验日期和判断依据，方便其他维护者复核。

| 信息     | 提供内容                                             | 对应配置或实现                                    |
| -------- | ---------------------------------------------------- | ------------------------------------------------- |
| 公司     | 国内公司或品牌名称、已有 ID 或建议的新 ID            | `companies`                                       |
| 发布主体 | 具体技术团队或组织，与公司的关系                     | `publishers`、`companyId`                         |
| 账号身份 | 平台名称、账号主页、稳定账号 ID；自有站说明域名归属  | 社区适配器与 `authorAllowlist`                    |
| 官方证据 | 官方域名、官网指向账号的链接、可核验的平台企业认证等 | `verification.evidenceUrls`、`note`、`reviewedAt` |
| 采集入口 | 读者入口、实际 RSS / Atom、公开 API 或文章目录 URL   | `entryUrl`、`url`、`adapter`、`platform`          |
| 访问边界 | robots.txt、公开访问条件、允许域名、请求频率与条数   | `linkHosts`、`crawl` 与适配器                     |
| 解析证据 | 最小 fixture、预期元数据、同名第三方账号等反例       | `tests/fixtures/`、`tests/unit/`                  |

账号昵称、头像或个人简介可以作为线索。核验官方身份还需要能确认账号归属的公开材料。社区平台同时托管个人与企业内容，因此应限定具体发布主体，避免把整个平台的文章归到同一家公司。

## 修改注册表

在 `packages/source-registry/registry.json` 中复用或新增公司与发布主体，再添加来源。字段定义以 `packages/shared/types.ts` 的 `sourceSchema` 为准，关联和 ID 唯一性由 `packages/source-registry/index.ts` 校验。

- ID 使用稳定的小写字母、数字与连字符。同一发布主体可以有多个来源，各来源保留自己的入口和采集状态。
- 本批新增公司使用 `region: "cn"`。请核验国内公司及发布主体归属，不将海外来源改标为国内来源。
- `entryUrl` 是读者识别来源的页面，`url` 是实际采集地址。明确列出需要访问的域名；跨域入口需要单独核验。
- RSS / Atom 优先。HTML 使用站点专用选择器，排除导航、活动和非文章链接。公开 API 若需新适配器，请同时实现并测试，当前 `adapter` 枚举没有通用 API 类型。
- `verified` 需要证据、核验说明和时间。证据未齐时使用 `pending`、`crawl.enabled: false`；已有官方身份但没有可用文章目录时，可登记为禁用的 `reference`。
- A/B/C 表示接入优先级。启用、身份核验和采集结果分别记录，不用其中一个代替另一个。
- 按站点公开访问条件设置采集间隔、条数和回填上限。不要绕过登录、验证码、付费限制或 robots.txt。

## 适配第三方社区账号

`authorAllowlist` 必须与适配器实际读取的身份字段一致。PR 中写清账号 ID、文章作者字段和官方证据之间的对应关系，并用反例测试证明同名账号不会混入。

现有腾讯云专栏解析器按创作者 UID 筛选；通用 Feed 解析器按 Feed 的作者文本精确匹配，不能将昵称匹配当作稳定 ID 核验。通用 HTML 列表解析器也不提供逐条作者身份校验。混合作者目录若无法可靠限定官方账号，需要增加专用解析逻辑，再启用来源。填写白名单字段本身不能代替解析器中的筛选。

## Fixture 与测试

Fixture 使用最小、可公开的 Feed、HTML 或结构化数据片段。保留解析所需的标题、链接、账号标识、日期和短介绍；删去全文、个人资料、Cookie、令牌与无关内容。开发 fixture 不得发布为真实文章。

按本次适配选择测试场景：

- 正常条目能解析出标题、规范 URL、发布主体相关字段和可用日期；缺失日期不会编造发布时间。
- 官方账号条目被保留，第三方作者、同名账号、导航与不允许域名被排除。
- 选择器失效、登录页、验证码、无效 Feed 或空目录能被识别，不把解析失败报告为采集成功。
- 正文不进入存储或公开导出；只保留必要元数据和原站提供的短介绍。
- 涉及多个发布渠道时，覆盖重复识别并保留来源关系，避免误并不同发布主体。

现有解析器测试见 `tests/unit/core.test.ts`，采集与故障状态测试见 `tests/unit/ingest.test.ts`。在对应测试中补充案例，或新建同目录测试文件。

需要 Node.js 22 或更新版本及 pnpm 10.20.0。仅文档修改可先检查格式和链接；来源或适配器修改至少运行：

```sh
pnpm install --frozen-lockfile
pnpm registry:check
pnpm exec vitest run tests/unit/core.test.ts tests/unit/ingest.test.ts
pnpm typecheck
```

PR 中记录实际运行的命令、结果和未验证事项。实测采集只针对本次来源，在隔离数据目录执行；不要为测试覆盖真实快照。仓库 CI 还会执行完整测试、fixture 构建、公开产物检查和浏览器验收，详细流程见 `.github/workflows/ci.yml`。

## 提交 PR

使用 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)描述新增入口或具体故障，附上身份材料、fixture、测试结果与已知限制。将注册表、适配器和相应测试放在同一 PR，便于检查完整行为。

不要提交本地快照、生成的文章数据、全文、凭据或个人资料。文章数量和来源数量是采集快照的结果，不能作为固定覆盖承诺。合并后仍需核对实际采集状态，才能确认新来源正常工作。

## English quick start

This initial release covers official engineering teams at Chinese companies. We welcome source adapters, parser fixes, ownership evidence, and metadata corrections for that scope. Official team accounts on third-party blogging communities are welcome alongside company-owned sites. Overseas sources are outside this batch.

Articles from verified, enabled official sources enter the index directly, with identity verification, deduplication, and data validation. There is no content relevance screening or automatic topic classification.

For a source PR, include its company, publisher, account URL and stable ID, public evidence of official ownership with a review date, and permitted collection endpoints. Prefer RSS / Atom. Respect robots.txt and public access conditions; include only essential metadata and short descriptions supplied by the source.

Register the company, publisher, and source in `packages/source-registry/registry.json`. Follow the schema in `packages/shared/types.ts`. Leave incomplete verification as `pending` with collection disabled. For mixed-author communities, implement and test per-item publisher filtering. The generic Feed parser matches author text; the Tencent column parser matches UID. The generic HTML parser does not verify each item's author, so an allowlist alone is insufficient.

Add small, public fixtures and tests for valid entries, unrelated or impersonating authors, missing metadata, and parser failures. Run the relevant commands above and report what remains unverified. Use the PR template; an incomplete lead can start as a source issue. A merged change is not proof that live collection has succeeded.
