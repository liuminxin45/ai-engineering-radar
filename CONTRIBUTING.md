# 贡献指南 / Contributing

## 可以贡献什么

欢迎提交 PR，适配国内官方来源、修复解析器、补充官方身份材料，或更正文章归属与元数据。首批仅接入国内公司官方技术团队，暂不增加海外公司来源。

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
| 近期更新 | 最近一篇官方原文的日期与链接；与入库记录是否一致     | PR 说明中的近期原文证据                           |

账号昵称、头像或个人简介可以作为线索。核验官方身份还需要能确认账号归属的公开材料。社区平台同时托管个人与企业内容，因此应限定具体发布主体，避免把整个平台的文章归到同一家公司。

## 修改注册表

在 `packages/source-registry/registry.json` 中复用或新增公司与发布主体，再添加来源。字段定义以 `packages/shared/types.ts` 的 `sourceSchema` 为准，关联和 ID 唯一性由 `packages/source-registry/index.ts` 校验。

- ID 使用稳定的小写字母、数字与连字符。博文保持每家公司最多一个可用来源。当前注册表只登记启用且已核验的采集源，禁用、待核验和访问受限的入口保留在调查文档中；仅有论文源的公司可以不登记博文源。论文渠道单独登记，使用能够验证机构归属的适配器，不占博文来源名额。
- 本批新增公司使用 `region: "cn"`。请核验国内公司及发布主体归属，不将海外来源改标为国内来源。
- `entryUrl` 是读者识别来源的页面，`url` 是实际采集地址。明确列出需要访问的域名；跨域入口需要单独核验。
- RSS / Atom 优先。HTML 使用站点专用选择器，排除导航、活动和非文章链接。公开 API 若需新适配器，请同时实现并测试，当前 `adapter` 枚举没有通用 API 类型。
- `verified` 需要证据、核验说明和时间。证据未齐时使用 `pending`、`crawl.enabled: false`；已有官方身份但没有可用文章目录时，可登记为禁用的 `reference`。
- A/B/C 表示接入优先级。启用、身份核验和采集结果分别记录，不用其中一个代替另一个。
- 检查账号是否仍在更新。超过一个月没有新文时，先核对置顶、分页、缓存和账号迁移；确认是历史渠道后使用 `suspended` 并关闭采集，保留证据和历史文章，不自动删除旧文。
- 按站点公开访问条件设置采集间隔、条数和回填上限。不要绕过登录、验证码、付费限制或 robots.txt。

## 适配第三方社区账号

`authorAllowlist` 必须与适配器实际读取的身份字段一致。PR 中写清账号 ID、文章作者字段和官方证据之间的对应关系，并用反例测试证明同名账号不会混入。

现有腾讯云专栏解析器按创作者 UID 筛选；通用 Feed 解析器按 Feed 的作者文本精确匹配，不能将昵称匹配当作稳定 ID 核验。通用 HTML 列表解析器也不提供逐条作者身份校验。混合作者目录若无法可靠限定官方账号，需要增加专用解析逻辑，再启用来源。填写白名单字段本身不能代替解析器中的筛选。

阿里云官方栏目使用 `aliyun-group`，按每篇的作者 profile ID 校验；不同官方团队分别关联发布主体。火山引擎账号使用 `volcengine-account`，目录中的稳定账号 ID 必须与每篇作者 ID 一致。两个平台均只解析审核过的目录，不能因托管域名属于公司而接纳其他投稿者。

## 博文与论文

来源可设置 `contentType: "blog"` 或 `"paper"`，省略时按博文处理。混合目录由适配器逐条返回 `Candidate.contentType`，不要根据标题中的“论文”二字判断类型。论文解读仍属于博文。

论文使用 `companyIds` 数组记录已核实的公司归属。数组中的 ID 必须来自公司注册表，至少有一项，不能重复。同一条论文会展示在这些公司的列中，“最新”列只展示一次。`companyId` 与 `publisherId` 继续记录来源所属公司和发布主体，与合作公司的署名归属分别保存。

每篇论文必须提供 `paperAffiliations`，记录公司 ID、证据 URL、核验方式和短机构摘录。证据须覆盖 `companyIds` 的每个公司。正式论文从出版方提交的作者机构字段核验；预印本读取论文首页作者署名；明确发布本团队研究成果的公司自有论文目录可以作为该公司的归属证据。正文提及、参考文献、提交人昵称和邮箱域名均不作为机构依据。高校署名不转换为公司 ID。

已有记录可在 `config/overrides.json` 中使用 `contentType`、`companyIds` 和 `paperAffiliations` 更正类型与归属，并填写核验依据 `reason`。改为论文时须提供归属及证据；改回博文会清除论文归属与证据。后续采集缺少类型或归属字段时保留已有值，人工更正会在采集和导出时重新应用。

论文渠道包括 Crossref 正式出版记录、公司自有研究目录，以及逐篇校验论文署名的机构论文页。Crossref 是出版方登记的元数据渠道，不是公司官方账号；查询命中后仍须通过作者机构的严格匹配。`paper-*` 适配器保持独立，普通博文适配器不能仅凭关键词给文章改成论文。实采及当前保留渠道见[论文来源核验](docs/paper-sources.md)。

`pnpm ingest:papers` 只更新论文来源，日常发布工作流仍更新全部启用来源。arXiv 署名请求遵守其 15 秒 crawl-delay；已有署名证据的论文复用快照，减少重复请求。缺少可用署名的候选会跳过，整个来源都没有可核实条目时报告失败并保留历史。

## Fixture 与测试

Fixture 使用最小、可公开的 Feed、HTML 或结构化数据片段。保留解析所需的标题、链接、账号标识、日期和短介绍；删去全文、个人资料、Cookie、令牌与无关内容。开发 fixture 不得发布为真实文章。

按本次适配选择测试场景：

- 正常条目能解析出标题、规范 URL、发布主体相关字段和可用日期；缺失日期不会编造发布时间。
- 官方账号条目被保留，第三方作者、同名账号、导航与不允许域名被排除。
- 选择器失效、登录页、验证码、无效 Feed 或空目录能被识别，不把解析失败报告为采集成功。
- 正文不进入存储或公开导出；只保留必要元数据和原站提供的短介绍。
- 涉及多个发布渠道时，覆盖重复识别并保留来源关系，避免误并不同发布主体。

现有解析器测试见 `tests/unit/core.test.ts`，采集与故障状态测试见 `tests/unit/ingest.test.ts`。在对应测试中补充案例，或新建同目录测试文件。

需要 Node.js 24.19.0 及 pnpm 10.20.0，与共享组件库要求保持一致。仅文档修改可先检查格式和链接；来源或适配器修改至少运行：

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

This initial release covers official engineering teams at Chinese companies. We welcome source adapters, parser fixes, ownership evidence, and metadata corrections for that scope. Official team accounts on third-party blogging communities are welcome alongside company-owned sites. Overseas companies are outside this batch.

Articles from verified, enabled official sources enter the index directly, with identity verification, deduplication, and data validation. There is no content relevance screening or automatic topic classification.

For a source PR, include its company, publisher, account URL and stable ID, public evidence of official ownership with a review date, and permitted collection endpoints. Prefer RSS / Atom. Respect robots.txt and public access conditions. Keep index metadata and short descriptions separate from sanitized blog bodies; retain author attribution and the original link. Never publish a summary as a full article.

Register the company, publisher, and source in `packages/source-registry/registry.json`. Follow the schema in `packages/shared/types.ts`. Leave incomplete verification as `pending` with collection disabled. For mixed-author communities, implement and test per-item publisher filtering. The generic Feed parser matches author text; the Tencent column parser matches UID. The generic HTML parser does not verify each item's author, so an allowlist alone is insufficient.

Add small, public fixtures and tests for valid entries, unrelated or impersonating authors, missing metadata, and parser failures. Run the relevant commands above and report what remains unverified. Use the PR template; an incomplete lead can start as a source issue. A merged change is not proof that live collection has succeeded.

正文解析与渲染扩展遵循[阅读页维护](docs/article-reader.md)。新增规则须保存来源与版本，并验证图片、代码、表格、目录及访问失败。RSSHub 服务的改动按其独立 AGPL-3.0 许可维护，见 [RSSHub 说明](docs/rsshub.md)。
