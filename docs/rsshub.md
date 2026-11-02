# RSSHub 接入与 CSDN 验证

## 职责与范围

RSSHub 用于七个已核验 CSDN 账号的文章发现与普通正文请求。请求或正文验收失败后，可由独立 Camoufox 服务取得 HTML，再交给同一解析引擎。职责与接口见[获取层维护](acquisition.md)。Jina Reader、Trafilatura 和 Crawl4AI 均未引入。

`services/rsshub/` 是独立 Node.js 服务，固定使用 `rsshub@1.0.0-master.23f13e4`。主采集器通过 HTTP 调用服务，不导入 RSSHub。服务仅监听 `127.0.0.1`，只开放注册表中已启用且已核验的 CSDN 账号路由，不开放任意 URL 代理。RSSHub 的全局网络钩子不会影响主采集器。

配置 `RSSHUB_URL` 后，CSDN 目录走 `/csdn/index/{account}`，正文按需走 `/csdn/body/{account}/{id}`，替代该来源的直接 RSS 和文章请求。其他来源保持现有适配器，避免用平台分类订阅替换官方账号身份。未配置该变量时兼容原来的直接采集方式。主采集器继续核对原文域名、账号路径、作者白名单和数据结构；RSSHub 的返回结果不会扩大来源范围。

## 本地启动

使用 Node.js 24.19.0、pnpm 10.20.0。服务依赖独立安装，锁文件与主应用分开维护。此处使用的 CSDN 路由不需要浏览器或安装脚本。

```powershell
pnpm --dir services/rsshub install --ignore-workspace --ignore-scripts --frozen-lockfile
node services/rsshub/server.mjs
```

在另一个 PowerShell 窗口中采集：

```powershell
$env:RSSHUB_URL="http://127.0.0.1:1200"
pnpm rsshub:check
pnpm ingest --daily --source=vivo-csdn
pnpm bodies:backfill --retry-unavailable
pnpm data:check
pnpm build
```

`GET /healthz` 只说明服务已启动。目录路由通过 RSSHub 的通用订阅路由读取固定的官方 RSS，不请求任何文章页；目录结果带 ETag，内容未变化时返回 304。单篇正文通过 RSSHub 公开的 `ofetch` API 请求已核验账号下的数字文章 ID，并沿用上游 `#content_views` 提取逻辑。这部分适配保存在 `services/rsshub/incremental.mjs`，采用相同的 AGPL-3.0 许可并注明来源。

目录与成功正文分别缓存 10 分钟；正文失败不写入成功缓存。主采集器只发送增量队列中的单篇请求，服务串行访问原站，避免整批正文请求。历史重试直接使用快照中的文章位置，不要求文章仍在最新 RSS 窗口内。此路径能重新尝试历史文章，但仍受 CSDN 访问状态限制。

服务固定使用当前 RSSHub 上游配置中的默认 UA。未配置 UA 时，当前包的随机请求头生成器在本机出现浏览器版本数据不匹配错误；固定上游默认值可避开该依赖问题。此配置不保证 CSDN 正文请求成功。

`pnpm rsshub:check` 是显式全量诊断命令，使用原始 `/csdn/blog/{account}` 路由，可能请求每个账号整批正文；它不参与每日增量任务。结果写入 `work/rsshub-validation.json`，不修改快照。其缓存与增量单篇请求独立，不应在日常采集前固定执行。服务自测运行 `pnpm --dir services/rsshub test`。

如本机需要显式出站代理，在启动服务前设置 `$env:RSSHUB_PROXY_URI=$env:HTTPS_PROXY`，或填写本机已有的代理环境变量。代理值只注入进程，不写入仓库、快照或前端。命令行不会自动读取 `.env`。主采集器的 `RSSHUB_URL` 支持本机 HTTP 或 HTTPS 服务地址；远程服务需自行配置 HTTPS 和访问控制。

工作流已加入独立服务安装、启动与健康检查，采集步骤注入本机服务地址。GitHub Actions 的实际运行及网络出口效果需在线执行后另行核实。

## 正文成功的判定

RSSHub 的 [CSDN 路由源码](https://github.com/DIYgod/RSSHub/blob/23f13e4/lib/routes/csdn/blog.ts)先读取官方账号 RSS，再请求每篇文章并提取 `#content_views`。请求失败时，路由会返回原始 RSS 条目。其 HTTP 状态仍可能是 200。

原始路由返回的 RSS 摘要位于 `content`；只有文章提取成功后才增加 `description`。增量目录将通用订阅路由的摘要统一放入 `content`，不提供正文字段；增量正文路由只有在正文容器非空时才返回 `description`，失败返回 502。主采集器仅将独立且非空的正文交给解析引擎，并排除与摘要文字相同的内容。正文失败不显示成完整文章；失败重试保留上次成功正文。

RSSHub 仍然需要访问 CSDN，不能保证消除 521。同一次验证中可能部分文章成功、部分失败；重试也可能改变结果。目录发现仍受官方 RSS 窗口限制，历史单篇重试以快照中的已收录位置为准。验证应分别报告发现条数、正文条数、摘要回退和历史窗口缺失，不能只报告服务返回 200。

## 许可与升级

RSSHub 采用 AGPL-3.0。本目录服务同样采用 AGPL-3.0-only，保留完整 [LICENSE](../services/rsshub/LICENSE)，通过 `/source` 提供服务与上游源码入口。项目其余代码按根目录许可维护，依赖及原文内容各自遵循原有许可。

升级时先更新独立包版本和锁文件，再核对 `creator`、`author`、`content` 与 `description` 的含义，运行 `tests/unit/rsshub.test.ts` 并实测至少一个成功正文和一个摘要回退。当前摘要判定依赖已固定的路由行为，不能跳过这一步。
