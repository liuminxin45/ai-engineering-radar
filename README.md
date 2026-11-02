<p><img src="apps/web/public/brand/logo.svg" width="300" height="100" alt="AI Engineering Radar" /></p>

聚合一线团队的 AI 工程实践，让值得学习的经验更容易被发现和持续追踪。

A radar for AI engineering practice from teams building and operating real systems. Follow official publications in company columns, discover new approaches, and learn from implementation choices and lessons from production. Browse columns side by side on desktop or swipe between them on mobile. This initial release follows teams at Chinese companies. Full articles stay on their original sites.

[网站](https://liuminxin45.github.io/ai-engineering-radar/) · [About / 关于](https://liuminxin45.github.io/ai-engineering-radar/about/) · [全站 RSS](https://liuminxin45.github.io/ai-engineering-radar/feed.xml) · [全站 Atom](https://liuminxin45.github.io/ai-engineering-radar/feed.atom)

## 为什么做这个项目

一线技术团队公开的实践，记录了 AI 从技术尝试走进真实业务的过程。这里有前沿方法的探索，也有架构取舍、部署经验、性能优化和踩坑复盘。许多具体的工程问题，可以从这些实践中找到值得借鉴的思路。

这些经验分散在公司技术博客、开发者社区和团队账号里。想持续跟进，往往需要记住多个入口，反复查看更新；有价值的文章也容易被错过，等到需要时又难以找回。

AI Engineering Radar 把这些分散的发布渠道聚集起来，持续追踪官方团队的新文章。希望每位开发者都能及时发现正在发生的工程探索，带着自己的问题去阅读、学习，再把合适的方法用到实践中。

## 如何使用

- **并排追踪公司**：打开[阅读看板](https://liuminxin45.github.io/ai-engineering-radar/)，先看“最新”列，再横向浏览各公司的文章。PC 可以同时看多列，每列独立上下滚动；手机左右滑动切换，也可以点击顶部公司名称定位。
- **带着问题查找**：搜索标题、摘要或作者，找到相关经验。手机点击搜索图标展开输入框，文章固定按最新优先展示。
- **回到原文学习**：点击文章标题，直接打开发布网站，阅读完整实现与适用条件。
- **持续追踪更新**：点击右上角 **ATOM/RSS**，在小窗中打开或复制两种全站订阅地址，统一追踪项目收录的更新。也可以直接使用[全站 RSS](https://liuminxin45.github.io/ai-engineering-radar/feed.xml) / [Atom](https://liuminxin45.github.io/ai-engineering-radar/feed.atom)。

每列先显示 20 篇文章，滚动到底部时自动追加 20 篇。搜索、当前公司列和已加载批次保存在链接中，支持刷新及浏览器前进后退，方便继续阅读或分享。右上角提供深浅色切换、ATOM/RSS、GitHub 图标和数据更新时间；手机显示更新时间的时分，完整日期可通过时间提示查看。

## 阅读界面

PC：公司分列，横向浏览。

![PC 多面板阅读看板](docs/images/board-desktop.png)

手机：单列阅读，露出下一列边缘，提示可以左右切换。

![手机多面板阅读看板](docs/images/board-mobile.png)

## 收录范围与来源

首批仅收录国内公司官方技术团队。已核验且启用的官方来源文章直接建立索引，保留身份核验、去重和数据校验，不按内容相关性筛选，也不做自动主题分类。本批暂不接入海外来源。

来源包括国内公司自有技术站，也欢迎博客园、腾讯云开发者社区、阿里云开发者社区等第三方博客社区中的国内公司官方团队账号。公司归属依据具体发布主体核验，不按托管平台的域名推断。

来源是否经过身份核验、是否启用、是否采集成功是三个独立状态，记录在[来源验收表](docs/source-acceptance.md)和[公开来源 JSON](https://liuminxin45.github.io/ai-engineering-radar/data/sources.json)中。待核验账号可以继续补充官方证据；缺少文章目录的入口可以继续贡献适配器。

来源还需要核查近期活跃度。HTTP 成功或能解析历史文章，不代表覆盖了近期更新。超过一个月没有新文章的渠道会人工复查。尚无可靠替代的过时来源暂停新增，保留历史；替代渠道已核验并真实采集后，移除指定旧源及仅由旧源支撑的文章，不按文章年龄自动删除。当前每家公司只登记一个来源，共 18 个公司或独立品牌栏目、18 个来源，其中 15 个启用，3 个暂停新增。阿里云使用指定账号主页，千问使用官方 Research 目录，蚂蚁保留百灵官网博客。百度智能云技术站 CSDN 已依据团队原创内容、多平台连续同步及百度自有社区的对应关系完成人工核验并启用，企业认证徽标不是唯一依据。

小米博文已按维护者指定改用 [MiMo 官网](https://mimo.xiaomi.com/)，实采 15 篇。小米只保留此源，其余未启用的参考入口已移除。最新明确发布日期为 2026-09-27；继续追踪更新，不视为近月活跃。OPPO、携程、小红书及快手更完整的长文渠道仍待补充，详见[来源核验记录](docs/source-research.md)。

当前采集源如下，按 2026-11-02 的[来源注册表](packages/source-registry/registry.json)整理。表中状态表示是否启用采集；最近采集结果见[来源验收表](docs/source-acceptance.md)。暂停新增的来源保留历史文章。

| 公司 | 来源入口 | 采集方式 | 状态 |
| --- | --- | --- | --- |
| 美团 | [美团技术团队](https://tech.meituan.com/) | RSS | 启用 |
| vivo | [vivo 互联网技术 · CSDN](https://blog.csdn.net/vivo_tech) | RSS | 启用 |
| 得物 | [得物技术 · 腾讯云](https://developer.cloud.tencent.com/user/9927536/articles) | 账号文章目录 | 启用 |
| 腾讯 | [腾讯技术工程 · 腾讯新闻](https://news.qq.com/omn/author/8QMZ23lf74UYuTs%3D) | 公开作者列表 API | 启用 |
| 阿里巴巴 / 阿里云 | [阿里云云原生 · 官方博客](https://developer.aliyun.com/group/apphub/article/) | 栏目 HTML | 启用 |
| 字节跳动 | [字节跳动开源 · 火山引擎](https://developer.volcengine.com/user/1333053764416295) | 账号文章目录 | 启用 |
| 百度 | [百度智能云技术站 · CSDN](https://blog.csdn.net/2301_82040283) | RSS | 启用 |
| 华为 | [华为云开发者联盟 · CSDN](https://blog.csdn.net/devcloud) | RSS | 启用 |
| 快手 | [快手技术 · CSDN](https://blog.csdn.net/kuaishoutech) | RSS | 启用 |
| 蚂蚁集团 | [蚂蚁百灵 · 官方博客](https://developer.ant-ling.com/zh-CN/blogs) | 博客 HTML | 启用 |
| 小米 | [小米 MiMo · 官方博客](https://mimo.xiaomi.com/) | 官网博客列表与文章页 | 启用 |
| OPPO | [OPPO 数智技术 · 思否](https://segmentfault.com/blog/oppotech) | RSS | 暂停新增 |
| 京东 | [京东云开发者 · 博客园](https://www.cnblogs.com/Jcloud/) | 账号 HTML 目录 | 启用 |
| 携程 | [携程技术 · CSDN](https://blog.csdn.net/ctrip_tech) | RSS | 暂停新增 |
| 小红书 | [小红书技术 REDtech · CSDN](https://blog.csdn.net/REDtech_1024) | RSS | 暂停新增 |
| 网易 | [网易数帆大数据 · CSDN](https://blog.csdn.net/wangyiyungw) | RSS | 启用 |
| B站 | [哔哩哔哩技术 · CSDN](https://blog.csdn.net/bilibili_TC) | RSS | 启用 |

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

已有快照时跳过初始化。初始化命令会拒绝覆盖已有数据。默认数据目录为 `.radar/data`，可以通过 `RADAR_DATA_DIR` 指定其他目录。

不联网体验可运行测试夹具，但夹具仅用于开发，严禁作为线上内容发布：

```sh
pnpm test:fixture
# Set RADAR_DATA_DIR=.radar/fixtures before exporting the fixture snapshot.
pnpm export
pnpm dev
```

环境变量由 shell 或运行平台注入；参考 `.env.example`。命令行采集器不会自动加载 `.env` 文件。

## 构建与验证

```sh
pnpm registry:check
pnpm data:check
pnpm test
pnpm build
pnpm typecheck
pnpm check:public
pnpm exec playwright install chromium
pnpm test:e2e
```

浏览器验收服务器默认使用 `/ai-engineering-radar/`，运行对应测试前设置 `BASE_PATH=/ai-engineering-radar`、`SITE_URL=https://example.org` 并重新构建。验收覆盖横向浏览、列内滚动、搜索、触底自动加载、标题直达发布网站和 URL 恢复；包含桌面浅色、375px 手机深色及减少动态效果。

## 来源贡献与人工复核

欢迎提交 PR，补充国内官方来源、官方身份材料或已有来源的解析修复。完整步骤、字段说明及测试要求见 [贡献指南](CONTRIBUTING.md)。你可以先提供公开线索，再一起补全证据与适配器。

修改 `packages/source-registry/registry.json` 时，来源必须关联公司和发布主体；社区中的文章不得根据托管域名判断公司归属。

- A/B/C 为接入优先级，不等于身份已认证。
- `verified` 必须附带官方域名、官网反向链接或平台企业认证等证据、核验说明及日期。
- `pending` 不采集文章；`suspended` 停止新增并保留历史；`rejected` 来源不再作为公开文章的有效身份依据。
- 已完成替换的旧源从注册表及公开索引移除。迁移会先检查替代渠道的官方身份和实际采集记录，保留其他发布位置仍有效的文章及稳定 ID。
- RSS / Atom 优先；公开 API 及站点 HTML 解析必须使用经审核的入口和站点专用适配。
- 社区来源必须设置 `authorAllowlist`，匹配稳定可核验的发布主体；无法确认时保持禁用。

We welcome PRs for official engineering sources at Chinese companies, including team accounts hosted by third-party blogging communities. Overseas sources are outside this batch. Include the company, publisher, stable account ID, public evidence of ownership, permitted collection endpoint, and adapter fixtures with tests. See [CONTRIBUTING.md](CONTRIBUTING.md) for the current adapter requirements.

文章无需经过相关性规则或模型审核。发现归属、链接、日期或重复关系有误时，请提供原文地址与证据。`config/overrides.json` 可用于人工更正或隐藏记录；确定的同一发布主体跨平台重复可在 `merges` 添加 `from`、`into` 和 `reason`。相似标题只提示复核，不自动合并。

目前试运行“疑似软文”标记：依据标题和原站短摘要，识别明确的福利促销、活动报名和集中产品宣传信号。命中条目右下角显示红色标签，点击可查看原因和原文片段。标记不影响展示、排序、搜索和订阅，也不代表已经审查全文。人工复核清单见站点 `/data/advertorial-review.json`；规则边界与更正方法见[软文标记试运行说明](docs/advertorial-trial.md)。

## 静态接口与订阅

所有路径均相对站点基路径。JSON 为公开快照，不接受服务端搜索或游标参数。

| 路径                       | 内容           |
| -------------------------- | -------------- |
| `/data/articles.json`      | 已发布文章索引 |
| `/data/articles/{id}.json` | 单篇元数据     |
| `/data/companies.json`     | 公司目录       |
| `/data/sources.json`       | 来源及检测状态 |
| `/data/health.json`        | 最近采集快照   |
| `/feed.xml`、`/feed.atom`  | 全站最近 50 篇 |

网站统一提供全站订阅。订阅 ID 不随标题、URL 修改或站点域名变化。原文没有发布时间时使用发现时间，详情页明确说明。缓存及响应头由 GitHub Pages 管理。

## 部署、故障与恢复

参见 [运行维护](docs/operations.md) 和 [P0 设计](docs/design.md)。首次部署前必须建立 `data` 分支并存入合法的 `snapshot/`；自动化不会在读取失败时初始化空数据。

可以手动运行 **Collect and publish**：启用 `collect` 执行采集，关闭则仅从现有快照重新发布。单来源失败不会删除历史文章；全部来源采集失败会停止发布，保留线上版本。

## 许可与内容版权

代码采用 [MIT](LICENSE)。来源文章、摘要、名称和商标归相应权利人所有，不因本项目开源而重新授权。本站仅保存必要元数据及原站提供的短介绍，完整内容请访问原站。权利人可通过仓库 Issue 请求更正或移除。
