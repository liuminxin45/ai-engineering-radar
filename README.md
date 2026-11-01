# AI Engineering Radar

发现真实的 AI 工程实践。追踪公司官方技术团队，提供可搜索的文章索引和 RSS / Atom 订阅。

[网站](https://liuminxin45.github.io/ai-engineering-radar/) · [RSS](https://liuminxin45.github.io/ai-engineering-radar/feed.xml) · [Atom](https://liuminxin45.github.io/ai-engineering-radar/feed.atom) · [来源目录](https://liuminxin45.github.io/ai-engineering-radar/sources/)

## 项目做什么

来源注册与官方身份核验、增量采集、元数据去重、AI 工程分类、网页索引和开放订阅。覆盖 Agent、AI Coding、Harness、RAG、推理、评测、AI 基础设施和工程应用。

首批登记 40 条指定入口，另补充得物技术官网。来源是否经过身份核验、是否启用、是否采集成功是三个独立状态，均可在来源目录查看。未通过核验的第三方账号和缺少文章目录的开发者门户不会自动产生公开文章。

不保存或提供文章全文，不提供登录、收藏、推荐榜单和评论。文章保留原始语言。

## 技术与运行方式

TypeScript、Node.js 22、pnpm workspace、Next.js 静态导出。全部业务状态使用带校验和的版本化 JSON，无数据库、ORM 或常驻后端。

`main` 保存代码和来源注册表。`data` 分支的 `snapshot/` 保存文章、来源状态及快照清单。Actions 每日北京时间 09:17 恢复快照，采集、分类、构建和验证，通过后保存数据并部署 GitHub Pages。Actions 可能延迟执行，不能视为严格时间保证。

## 本地启动

需要 Node.js 22 或更新版本，以及 pnpm 10.20.0。

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

浏览器验收服务器默认使用 `/ai-engineering-radar/`，运行对应测试前设置 `BASE_PATH=/ai-engineering-radar`、`SITE_URL=https://example.org` 并重新构建。测试包含桌面浅色和 375px 手机深色、减少动态效果两种配置。

## 来源贡献与人工复核

修改 `packages/source-registry/registry.json` 后提交 PR。来源必须关联公司和发布主体；社区中的文章不得根据托管域名判断公司归属。

- A/B/C 为接入优先级，不等于身份已认证。
- `verified` 必须附带官方域名、官网反向链接或平台企业认证等证据、核验说明及日期。
- `pending` 不采集文章；`suspended` 停止新增并保留历史；`rejected` 来源不再作为公开文章的有效身份依据。
- RSS / Atom 优先；公开 API 及站点 HTML 解析必须使用经审核的入口和站点专用适配。
- 社区来源必须设置 `authorAllowlist`，匹配稳定可核验的发布主体；无法确认时保持禁用。

规则仅发布具有 AI 关联、工程行动和具体实现机制的条目。元数据不足进入 `review`，模型失败进入 `pending`，商业新闻和营销内容进入 `rejected`。

人工修改 `config/overrides.json`，例如：

```json
{
  "schemaVersion": 1,
  "articles": {
    "文章的20位十六进制ID": {
      "status": "accepted",
      "topics": ["agent"],
      "reason": "已阅读原文，包含工具调用与沙箱运行时实现。"
    }
  },
  "merges": []
}
```

设置 `hidden: true` 隐藏文章。确定的跨平台重复可在 `merges` 添加 `from`、`into` 和 `reason`；只允许相同发布主体。相似标题只提示复核，不自动合并。人工决定优先于自动分类。

## 可选模型

默认无需模型或付费密钥。需要模型处理不确定条目时，在 GitHub Repository Variables 配置 `CLASSIFIER_BASE_URL`（兼容接口地址，包含 `/v1`）、`CLASSIFIER_MODEL`，在 Secrets 配置 `CLASSIFIER_API_KEY`。单次最多处理 20 条，超时或输出不合格保留待处理。

不要将密钥写入来源配置、数据分支、客户端代码或日志。外部 PR 不读取密钥。

## 静态接口与订阅

所有路径均相对站点基路径。JSON 为公开快照，不接受服务端搜索或游标参数。

| 路径 | 内容 |
| --- | --- |
| `/data/articles.json` | 已发布文章索引 |
| `/data/articles/{id}.json` | 单篇元数据 |
| `/data/companies.json`、`/data/topics.json` | 公司和主题 |
| `/data/sources.json` | 来源及检测状态 |
| `/data/health.json` | 最近采集快照 |
| `/feed.xml`、`/feed.atom` | 全站最近 50 篇 |
| `/feed/company/{id}.xml`、`.atom` | 公司订阅 |
| `/feed/topic/{id}.xml`、`.atom` | 主题订阅 |

订阅 ID 不随标题、URL 修改或站点域名变化。原文没有发布时间时使用发现时间，详情页明确说明。缓存及响应头由 GitHub Pages 管理。

## 部署、故障与恢复

参见 [运行维护](docs/operations.md) 和 [P0 设计](docs/design.md)。首次部署前必须建立 `data` 分支并存入合法的 `snapshot/`；自动化不会在读取失败时初始化空数据。

可以手动运行 **Collect and publish**：启用 `collect` 执行采集，关闭则仅从现有快照重新发布。单来源失败不会删除历史文章；全部来源采集失败会停止发布，保留线上版本。

## 许可与内容版权

代码采用 [MIT](LICENSE)。来源文章、摘要、名称和商标归相应权利人所有，不因本项目开源而重新授权。本站仅保存必要元数据及原站提供的短介绍，完整内容请访问原站。权利人可通过仓库 Issue 请求更正或移除。
