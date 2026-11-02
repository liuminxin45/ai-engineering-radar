# AI 协作与维护说明

## 文档分工

README 面向产品读者，优先介绍产品目标、核心功能、界面与来源。开发命令、技术实现、来源核验规则和部署细节放在本文件或对应的维护文档中。

按任务阅读相关文档：

- [技术设计](docs/design.md)：数据流、实体、去重、页面行为和 URL 状态。
- [阅读页维护](docs/article-reader.md)：解析引擎、正文补抓及重试。
- [RSSHub 维护](docs/rsshub.md)：独立服务与增量正文请求。
- [获取层维护](docs/acquisition.md)：文档接口、CSDN 浏览器回退与正式工作流。
- [运行维护](docs/operations.md)：采集调度、数据分支、来源迁移、恢复与发布。
- [贡献指南](CONTRIBUTING.md)：来源材料、适配器与测试要求。
- [内容规则标签](docs/content-signals.md)：可解释提示与可选活动过滤。
- [软文标记试运行](docs/advertorial-trial.md)：标记范围、人工复核与更正方法。
- [来源验收](docs/source-acceptance.md)、[来源调查](docs/source-research.md)和[第二轮调查](docs/source-research-round2.md)：接入证据与实测结果。
- 修改 Web 应用时，遵循 [Web 应用指引](apps/web/AGENTS.md)。

## 技术与运行方式

TypeScript、Node.js 24.19.0、pnpm workspace、Next.js 静态导出。全部业务状态使用带校验和的版本化 JSON，无数据库、ORM 或常驻后端。

`main` 保存代码和来源注册表。`data` 分支的 `snapshot/` 保存文章、来源状态及快照清单。Actions 每日北京时间 09:17 恢复快照，采集、构建和验证，通过后保存数据并部署 GitHub Pages。Actions 可能延迟执行，不能视为严格时间保证。

## 本地启动

需要 Node.js 24.19.0 和 pnpm 10.20.0。共享组件库从固定 Git 版本构建，要求此精确 Node.js 版本；本地与 CI 使用相同版本。

```sh
pnpm install --frozen-lockfile
pnpm data:init
pnpm ingest --force
pnpm export
pnpm dev
```

`pnpm ingest --force` 检查全部启用来源，内容按增量策略处理。每日任务使用 `pnpm ingest --daily`，重试失败文章并跳过未变化的成功正文。主动全量刷新使用 `pnpm ingest --full`。只诊断单个来源可运行 `pnpm ingest --force --source=来源ID`。

已有快照时跳过初始化。初始化命令会拒绝覆盖已有数据。默认数据目录为 `.radar/data`，可以通过 `RADAR_DATA_DIR` 指定其他目录。

不联网体验可运行测试夹具，但夹具仅用于开发，严禁作为线上内容发布：

```sh
export RADAR_DATA_DIR=.radar/fixtures
pnpm test:fixture
pnpm export
pnpm dev
```

上述 `export` 适用于 Bash 等 shell；PowerShell 使用 `$env:RADAR_DATA_DIR=".radar/fixtures"`。恢复真实数据时，将数据目录改回 `.radar/data`，重新导出。

环境变量由 shell 或运行平台注入；参考 `.env.example`。命令行采集器不会自动加载 `.env` 文件。

## 构建与验证

```sh
pnpm registry:check
pnpm data:check
pnpm test
export BASE_PATH=/ai-engineering-radar
export SITE_URL=https://example.org
pnpm build
pnpm typecheck
pnpm check:public
pnpm exec playwright install chromium
pnpm test:e2e
```

上述构建命令使用 Bash 环境变量语法；PowerShell 对应 `$env:BASE_PATH="/ai-engineering-radar"` 和 `$env:SITE_URL="https://example.org"`。浏览器验收服务器默认使用 `/ai-engineering-radar/`，构建时的路径须与其一致。测试夹具需额外设置 `RADAR_ALLOW_FIXTURES=1` 才能通过公开内容检查；发布构建应使用真实快照。验收覆盖横向浏览、列内滚动、搜索、触底自动加载、标题直达发布网站和 URL 恢复；包含桌面浅色、375px 手机深色及减少动态效果。

仅修改文档时，检查 Markdown 格式、本地链接和差异即可。报告实际运行的检查及未验证事项；不把本地验证当作线上发布或定时触发成功。

## 收录与来源维护

收录国内公司的官方团队博文，当前不扩展到海外公司。博文核验官方发布账号。保留来源证据、去重和数据校验，不按关键词筛选内容，也不做自动主题分类。

来源包括公司自有技术站，以及博客园、腾讯云开发者社区、阿里云开发者社区等平台中的官方团队账号。公司归属依据具体发布主体核验，不按托管平台域名推断。采集范围以具体团队和可核验的论文归属为准，各入口不代表覆盖集团全部内容。

[来源注册表](packages/source-registry/registry.json)保存当前配置，字段和约束分别见[类型定义](packages/shared/types.ts)与[注册表校验](packages/source-registry/index.ts)。每家公司至少有一个可采集来源，最多登记一个博文源。修改时以实际校验与测试为准。

- A/B/C 为接入优先级，不等于身份已认证。
- 当前注册表只接受已核验且启用的采集源。`verified` 必须附带官方域名、官网反向链接或平台企业认证等证据、核验说明及日期。
- `pending`、`suspended` 和 `reference` 仅用于历史快照兼容。待核验线索保留在提议与调查文档中。
- RSS / Atom 优先；公开 API 及 HTML 解析使用经审核的入口和站点专用适配器。
- 社区来源设置 `authorAllowlist`，适配器须实际校验稳定的发布主体标识，不能只填写配置。

来源变更以注册表为准。替换或移除来源时，同步清理退出来源的状态和独占记录，保留其他有效来源支持的文章与稳定 ID。迁移先检查替代渠道的官方身份与实际采集记录，具体流程见[运行维护](docs/operations.md)。README 来源表的顺序与阅读看板一致。

`config/overrides.json` 用于人工更正或隐藏记录。确定的同一发布主体跨平台重复可在 `merges` 添加 `from`、`into` 和 `reason`。相似标题只提示复核，不自动合并。

博文正文单独保存在快照并静态渲染，保留原始语言、作者及原文入口。原始页面不落库，摘要不能当作全文。正文失败保留已有内容。不提供登录、收藏、推荐榜单和评论。

## 静态接口与订阅

所有路径均相对站点基路径。JSON 为公开快照，不接受服务端搜索或游标参数。

| 路径                       | 内容             |
| -------------------------- | ---------------- |
| `/data/articles.json`      | 已发布博文索引   |
| `/data/articles/{id}.json` | 单篇元数据       |
| `/data/bodies.json`        | 博文正文状态     |
| `/data/bodies/{id}.json`   | 单篇清洗后的正文 |
| `/data/companies.json`     | 公司目录         |
| `/data/sources.json`       | 来源及检测状态   |
| `/data/health.json`        | 最近采集快照     |
| `/feed.xml`、`/feed.atom`  | 全站最近 50 篇   |

网站统一提供全站订阅。订阅 ID 不随标题、URL 修改或站点域名变化。原文没有发布时间时使用发现时间，详情页明确说明。缓存及响应头由 GitHub Pages 管理。

## 部署、故障与恢复

参见 [运行维护](docs/operations.md) 和 [P0 设计](docs/design.md)。首次部署前必须建立 `data` 分支并存入合法的 `snapshot/`；自动化不会在读取失败时初始化空数据。

可以手动运行 **Collect and publish**：启用 `collect` 执行采集，关闭则仅从现有快照重新发布。采集失败会保留已有文章；全部尝试采集的来源均失败时，流程停止发布。显式移除来源时，按迁移规则清理相关历史记录。

## 正文解析方案参考

博文统一阅读页的正文解析方案参考了 [简悦 SimpRead](https://github.com/Kenshin/simpread) 的[站点解析规则](https://github.com/Kenshin/simpread/blob/d6534a7d67ab606e0390ff7172360fac88af4422/src/website_list.json)，包括 URL 匹配、标题与正文容器选择，以及无关节点排除。感谢 Kenshin 与项目贡献者。

正文解析引擎位于 `packages/article-parser/`，与采集、存储和渲染分离。参考版本与扩展方式见[阅读页维护](docs/article-reader.md)；复用代码或规则按对应许可处理。
