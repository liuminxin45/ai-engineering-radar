<p><img src="apps/web/public/brand/logo.svg" width="300" height="100" alt="AI Engineering Radar" /></p>

聚合一线团队的 AI 工程实践，让值得学习的经验更容易被发现和持续追踪。

A radar for AI engineering practice from teams building and operating real systems. Follow official publications in company columns, discover new approaches, and learn from implementation choices and lessons from production. Browse columns side by side on desktop or swipe between them on mobile. This initial release follows teams at Chinese companies. Papers include per-company affiliation evidence from publisher records, paper author signatures or official research directories. Full articles and papers stay on their original sites.

[网站](https://liuminxin45.github.io/ai-engineering-radar/) · [About / 关于](https://liuminxin45.github.io/ai-engineering-radar/about/) · [全站 RSS](https://liuminxin45.github.io/ai-engineering-radar/feed.xml) · [全站 Atom](https://liuminxin45.github.io/ai-engineering-radar/feed.atom)

## 为什么做这个项目

一线技术团队公开的实践，记录了 AI 从技术尝试走进真实业务的过程。这里有前沿方法的探索，也有架构取舍、部署经验、性能优化和踩坑复盘。许多具体的工程问题，可以从这些实践中找到值得借鉴的思路。

这些经验分散在公司技术博客、开发者社区和团队账号里。想持续跟进，往往需要记住多个入口，反复查看更新；有价值的文章也容易被错过，等到需要时又难以找回。

AI Engineering Radar 把这些分散的发布渠道聚集起来，持续追踪官方团队的新文章。希望每位开发者都能及时发现正在发生的工程探索，带着自己的问题去阅读、学习，再把合适的方法用到实践中。

## 如何使用

- **切换博文与论文**：顶部提供“博文 / 论文”两个入口，默认展示博文。两类内容共用公司分列看板，搜索限定当前类型；切换时保留当前公司和关键词，从首批内容开始阅读。联合论文按已核实的公司归属展示在多列中，“最新”列只展示该条记录一次。
- **并排追踪公司**：打开[阅读看板](https://liuminxin45.github.io/ai-engineering-radar/)，先看“最新”列，再横向浏览各公司的文章。PC 可以同时看多列，在公司导航、面板标题或列间空隙滚动鼠标滚轮，即可左右浏览；正文区域保持上下滚动。手机左右滑动切换，也可以点击顶部公司名称定位。
- **带着问题查找**：搜索标题、摘要或作者，找到相关经验。点击右上角放大镜或按 `Ctrl/⌘ + K` 打开搜索窗口。支持关键词高亮、方向键选择和回车打开原文；按 `Esc` 关闭后焦点回到搜索按钮。看板文章仍按最新优先展示。
- **回到原文学习**：点击文章标题，直接打开发布网站，阅读完整实现与适用条件。
- **持续追踪更新**：点击右上角 **ATOM/RSS**，在小窗中打开或复制两种全站订阅地址，统一追踪项目收录的更新。也可以直接使用[全站 RSS](https://liuminxin45.github.io/ai-engineering-radar/feed.xml) / [Atom](https://liuminxin45.github.io/ai-engineering-radar/feed.atom)。

每列先显示 20 篇，滚动到底部时自动追加 20 篇。内容类型、搜索、当前公司列和已加载批次保存在链接中，支持刷新及浏览器前进后退，方便继续阅读或分享。右上角提供搜索、深浅色切换、ATOM/RSS、GitHub 图标和数据更新时间；手机显示更新时间的时分，完整日期可通过时间提示查看。

论文已接入正式出版元数据、官方研究目录和可核验作者机构的预印本渠道。归属证据随论文 JSON 保存，详情页提供核验链接。具体渠道见下方的[论文来源](#论文来源)，接入方式见[贡献指南](CONTRIBUTING.md#博文与论文)。

## 阅读界面

PC：公司分列，横向浏览。

![PC 多面板阅读看板](docs/images/board-desktop.png)

手机：单列阅读，露出下一列边缘，提示可以左右切换。

![手机多面板阅读看板](docs/images/board-mobile.png)

## 收录范围与来源

收录国内公司的官方团队博文与署名研究论文，本批暂不扩展到海外公司。博文核验官方发布账号，论文核验作者机构或官方研究目录。保留来源证据、去重和数据校验，不按关键词筛选内容，也不做自动主题分类。

来源包括国内公司自有技术站，也欢迎博客园、腾讯云开发者社区、阿里云开发者社区等第三方博客社区中的国内公司官方团队账号。公司归属依据具体发布主体核验，不按托管平台的域名推断。

当前注册表只登记已核验且启用的采集源。每家公司或独立品牌栏目最多一个博文源；没有可用博文源时，可以只保留论文源。采集范围以具体团队和可核验的论文归属为准，各入口不代表覆盖集团全部内容。

来源变更以注册表为准。替换或移除来源时，同步清理退出来源的状态和独占记录，保留其他有效来源支持的文章与稳定 ID。当前来源如下，顺序与阅读看板一致。

### 博文来源

| 公司     | 来源入口                                                                              | 采集方式          |
| -------- | ------------------------------------------------------------------------------------- | ----------------- |
| 腾讯     | [腾讯技术工程 · 腾讯新闻](https://news.qq.com/omn/author/8QMZ23lf74UYuTs%3D)          | 公开作者列表 API  |
| 得物     | [得物技术 · 腾讯云](https://developer.cloud.tencent.com/user/9927536/articles)        | 账号文章目录      |
| 千问     | [千问 · Research](https://qwen.ai/research)                                           | 官方研究目录 JSON |
| 字节跳动 | [字节跳动技术团队 · 火山引擎](https://developer.volcengine.com/user/2772312065061673) | 账号文章目录      |
| 美团     | [美团技术团队](https://tech.meituan.com/)                                             | RSS               |
| vivo     | [vivo 互联网技术 · CSDN](https://blog.csdn.net/vivo_tech)                             | RSS               |
| 华为     | [华为云开发者联盟 · CSDN](https://blog.csdn.net/devcloud)                             | RSS               |
| 快手     | [快手技术 · CSDN](https://blog.csdn.net/kuaishoutech)                                 | RSS               |
| 网易     | [网易数帆大数据 · CSDN](https://blog.csdn.net/wangyiyungw)                            | RSS               |
| B站      | [哔哩哔哩技术 · CSDN](https://blog.csdn.net/bilibili_TC)                              | RSS               |
| 京东     | [京东云开发者 · 博客园](https://www.cnblogs.com/Jcloud/)                              | 账号 HTML 目录    |
| 百度     | [百度智能云技术站 · CSDN](https://blog.csdn.net/2301_82040283)                        | RSS               |
| 蚂蚁集团 | [蚂蚁数据 AntData · CSDN](https://devpress.csdn.net/user/DB_GPT)                      | RSS               |

### 论文来源

论文按作者机构或官方研究目录核验。每篇记录保留归属证据；联合论文保留多个公司的归属，同一公司可以使用多个论文渠道。

| 公司              | 来源入口                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 腾讯              | [Crossref 出版方元数据](https://search.crossref.org/?q=Tencent)、[Tencent-Hunyuan 论文](https://huggingface.co/Tencent-Hunyuan/papers)                                                                     |
| 得物              | [Crossref 出版方元数据](https://search.crossref.org/?q=Dewu)                                                                                                                                               |
| 阿里巴巴 / 阿里云 | [Crossref 出版方元数据](https://search.crossref.org/?q=Alibaba)                                                                                                                                            |
| 字节跳动          | [Crossref 出版方元数据](https://search.crossref.org/?q=ByteDance)、[ByteDance-Seed 论文](https://huggingface.co/ByteDance-Seed/papers)、[ByteDance Seed 论文](https://seed.bytedance.com/en/public_papers) |
| 美团              | [Crossref 出版方元数据](https://search.crossref.org/?q=Meituan)、[meituan-longcat 论文](https://huggingface.co/meituan-longcat/papers)                                                                     |
| vivo              | [Crossref 出版方元数据](https://search.crossref.org/?q=vivo%20Mobile%20Communication)                                                                                                                      |
| 华为              | [Crossref 出版方元数据](https://search.crossref.org/?q=Huawei)、[Huawei Noah 论文](https://www.noahlab.com.hk/en/research_paper)                                                                           |
| 快手              | [Crossref 出版方元数据](https://search.crossref.org/?q=Kuaishou)                                                                                                                                           |
| 网易              | [Crossref 出版方元数据](https://search.crossref.org/?q=NetEase)、[AAAI 联合论文](https://ojs.aaai.org/index.php/AAAI/article/view/26509)                                                                   |
| B站               | [Crossref 出版方元数据](https://search.crossref.org/?q=Bilibili)                                                                                                                                           |
| 京东              | [Crossref 出版方元数据](https://search.crossref.org/?q=JD.com)                                                                                                                                             |
| 百度              | [Crossref 出版方元数据](https://search.crossref.org/?q=Baidu)、[baidu 论文](https://huggingface.co/baidu/papers)                                                                                           |
| 蚂蚁集团          | [Crossref 出版方元数据](https://search.crossref.org/?q=Ant%20Group)、[antgroup 论文](https://huggingface.co/antgroup/papers)                                                                               |
| 携程              | [Crossref 出版方元数据](https://search.crossref.org/?q=Ctrip)、[TripScore 论文](https://arxiv.org/html/2510.09011v3)                                                                                       |

以上入口与[来源注册表](packages/source-registry/registry.json)对应。最近采集结果见[公开来源 JSON](https://liuminxin45.github.io/ai-engineering-radar/data/sources.json)，逐篇论文归属与实采记录见[论文来源核验](docs/paper-sources.md)。

不保存或提供文章全文，不提供登录、收藏、推荐榜单和评论。文章保留原始语言。

项目介绍见 [中文 / English About](docs/about.md)。欢迎[提交 PR 适配新来源](CONTRIBUTING.md)，也可以用[来源提议模板](https://github.com/liuminxin45/ai-engineering-radar/issues/new?template=source.yml)提供线索。

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

`pnpm ingest --force` 采集全部启用来源，包括博文和论文；只更新论文可运行 `pnpm ingest:papers --force`。

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

## 来源贡献与人工复核

欢迎提交 PR，补充国内官方来源、官方身份材料或已有来源的解析修复。完整步骤、字段说明及测试要求见 [贡献指南](CONTRIBUTING.md)。你可以先提供公开线索，再一起补全证据与适配器。

修改 `packages/source-registry/registry.json` 时，来源必须关联公司和发布主体；社区中的文章不得根据托管域名判断公司归属。每家公司最多一个博文源，论文源单独核验。

- A/B/C 为接入优先级，不等于身份已认证。
- `verified` 必须附带官方域名、官网反向链接或平台企业认证等证据、核验说明及日期。
- `pending`、`suspended` 和 `reference` 仅用于历史快照兼容；当前注册表只接受启用且已核验的采集源。待核验线索先保留在提议与调查文档中。
- 已完成替换的旧源从注册表及公开索引移除。迁移会先检查替代渠道的官方身份和实际采集记录，保留其他发布位置仍有效的文章及稳定 ID。
- RSS / Atom 优先；公开 API 及站点 HTML 解析必须使用经审核的入口和站点专用适配。
- 社区来源必须设置 `authorAllowlist`，匹配稳定可核验的发布主体；身份无法确认的入口先保留在线索文档中，暂不加入注册表。

We welcome PRs for official engineering sources at Chinese companies, including team accounts hosted by third-party blogging communities. Overseas companies are outside this batch. Include the company, publisher, stable account ID, public evidence of ownership, permitted collection endpoint, and adapter fixtures with tests. See [CONTRIBUTING.md](CONTRIBUTING.md) for the current adapter requirements.

博文不经过相关性规则或模型审核；论文须先通过公司归属核验。发现归属、链接、日期或重复关系有误时，请提供原文地址与证据。`config/overrides.json` 可用于人工更正或隐藏记录；确定的同一发布主体跨平台重复可在 `merges` 添加 `from`、`into` 和 `reason`。相似标题只提示复核，不自动合并。

目前试运行“疑似软文”标记：依据标题和原站短摘要，识别明确的福利促销、活动报名和集中产品宣传信号。命中条目右下角显示红色标签，点击可查看原因和原文片段。标记不影响展示、排序、搜索和订阅，也不代表已经审查全文。人工复核清单见站点 `/data/advertorial-review.json`；规则边界与更正方法见[软文标记试运行说明](docs/advertorial-trial.md)。

## 静态接口与订阅

所有路径均相对站点基路径。JSON 为公开快照，不接受服务端搜索或游标参数。

| 路径                       | 内容                 |
| -------------------------- | -------------------- |
| `/data/articles.json`      | 已发布博文与论文索引 |
| `/data/articles/{id}.json` | 单篇元数据           |
| `/data/companies.json`     | 公司目录             |
| `/data/sources.json`       | 来源及检测状态       |
| `/data/health.json`        | 最近采集快照         |
| `/feed.xml`、`/feed.atom`  | 全站最近 50 篇       |

网站统一提供全站订阅。订阅 ID 不随标题、URL 修改或站点域名变化。原文没有发布时间时使用发现时间，详情页明确说明。缓存及响应头由 GitHub Pages 管理。

## 部署、故障与恢复

参见 [运行维护](docs/operations.md) 和 [P0 设计](docs/design.md)。首次部署前必须建立 `data` 分支并存入合法的 `snapshot/`；自动化不会在读取失败时初始化空数据。

可以手动运行 **Collect and publish**：启用 `collect` 执行采集，关闭则仅从现有快照重新发布。采集失败会保留已有文章；全部尝试采集的来源均失败时，流程停止发布。显式移除来源时，按迁移规则清理相关历史记录。

## 许可与内容版权

代码采用 [MIT](LICENSE)。来源文章、摘要、名称和商标归相应权利人所有，不因本项目开源而重新授权。本站仅保存必要元数据及原站提供的短介绍，完整内容请访问原站。权利人可通过仓库 Issue 请求更正或移除。
