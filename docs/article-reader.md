# 博文阅读页维护

## 数据与阅读行为

博文标题和搜索结果打开本站 `/articles/{id}/`。阅读页参照个人博客的文章布局：760px 正文、二三级标题目录、顶部阅读进度、图片放大和深浅色。1040px 以下使用折叠目录。顶部提供原文入口，原始 `canonicalUrl` 保留，页面 canonical 指向原文。

正文在采集阶段获取，在构建阶段按篇读取。首页数据、搜索索引和 RSS / Atom 只包含元数据与短介绍。RSS 条目的稳定 ID 和本站详情链接保持不变。

快照 v2 在 `bodies/{articleId}.json` 中保存清洗后的 HTML、目录、正文来源、规则版本、内容哈希、最近尝试及成功时间。清单包含正文文件校验和与数量，兼容读取没有正文的 v1 快照。原始页面、接口完整响应和站点脚本不写入快照。

正文状态包括 `ready`、`partial` 和 `unavailable`。正文长度不参与完整性判定，短文和单张图片也可标记为可读。通用提取、无法转换的嵌入或原站明确的阅读限制仍产生完整性提示。空正文及访问错误页会失败。

正文失败不隐藏文章；刷新失败保留上次成功正文。隐藏文章的正文不会导出，来源迁移清理无效关联。

`radar-reader-2` 移除了正文过短判定。`pnpm bodies:reclassify` 可离线应用兼容迁移：v1 引擎的状态更正保留 HTML 与哈希；CSDN v2 代码迁移到 v3 时更新正文及哈希，保留采集时间，并把空代码块标记为待刷新。其他原因造成的不完整提示继续保留。日常增量队列也会先应用迁移，避免重新抓取已成功正文。

## 解析引擎

`packages/article-parser/` 不负责网络请求、快照写入或页面渲染。`ArticleParser.parse()` 接受原文 URL、内容、可选标题和格式，输出统一的 HTML、目录、阅读时长、规则标识及状态。输入支持 HTML、Markdown 和发布方 Markdown token。

规则结构参考 [简悦 SimpRead](https://github.com/Kenshin/simpread) 的[站点规则](https://github.com/Kenshin/simpread/blob/d6534a7d67ab606e0390ff7172360fac88af4422/src/website_list.json)，参考提交为 `d6534a7d67ab606e0390ff7172360fac88af4422`。参考内容包括 URL 匹配、标题选择、正文容器选择及无关节点排除。本项目独立实现引擎，不加载简悦扩展，也不执行规则中的 JavaScript 表达式。直接复用其他项目的代码或规则时，须保留来源与对应许可；README 致谢不替代许可要求。

`rules.json` 保存声明式规则，`types.ts` 用 Zod 校验字段。每条规则包含稳定 ID、版本、精确域名、可选路径模式、标题选择器、正文候选选择器和排除选择器。选择器按顺序匹配。已知站点未匹配到正文时返回失败，防止把登录页或空壳识别为文章。没有适配规则的站点才使用 Mozilla Readability，并标记为待核对完整性。

`structured.ts` 提供 `StructuredExtractor` 接口，处理页面内的 JSON 或文档格式。当前包括腾讯云内嵌 Markdown 和阿里云 Lake。Lake 的脚本赋值只用 Acorn 读取字符串字面量，不执行脚本。`tokens.ts` 处理千问官方文档的 Markdown token 和图片、链接短代码。

所有路径最终进入同一清洗步骤：规范相对地址与懒加载图片、生成不冲突的标题锚点、修复文内链接、包装表格，再由 DOMPurify 清洗。原站样式、脚本、事件、表单和主动嵌入内容不会进入阅读页。JSDOM 不启用脚本或资源加载。图片保留原站 URL，使用懒加载与无 Referer 请求；图片失败时仍可从顶部访问原文。

## 扩展规则

普通 HTML 站点先在 `rules.json` 增加规则，并使用原站实际页面检查选择器。提升规则版本，添加最小公开夹具，验证标题、段落、列表、代码、表格、图片和目录。

结构化站点实现 `StructuredExtractor`，声明精确域名，并返回规范的解析输入。通过 `new ArticleParser(rules, extractors)` 注册扩展，或加入默认提取器。网络请求留在 `packages/crawler/body-fetchers.ts`，不能放进规则表达式或解析引擎。

正文接口位于其他域名时，先核实官网引用关系，在来源中登记 `bodyHosts`。该字段只用于正文请求，不扩大元数据采集范围。直接请求继续经过现有 HTTP 层的域名、公开地址、robots、重定向、大小和超时校验。

配置 `RSSHUB_URL` 后，CSDN 的发现和普通正文请求由独立 RSSHub 服务承担。配置 `BROWSER_FETCH_URL` 后，请求或正文验收失败会回退到独立 Camoufox 服务。两条路径都进入 CSDN v3 规则和同一清洗引擎，获取方式不改变快照或阅读页接口。分层、切换及自托管方式见[获取层维护](acquisition.md)和 [RSSHub 维护](rsshub.md)。

## 补抓与重试

日常 `pnpm ingest` 默认增量处理新增、有变化及上次失败的正文，包括不完整正文和保留旧 HTML 的刷新失败记录。每日 `--daily` 不再限制为 40 篇，也不等待失败记录的 7 天重试时间。成功且未变化的正文保持不动。详情见[运行维护](operations.md)。

历史补抓命令保留独立的手动检查策略，遍历快照内的已发布博文：

```sh
pnpm bodies:backfill
pnpm bodies:backfill --source=meituan
pnpm bodies:backfill --retry-unavailable
pnpm bodies:backfill --force --source=meituan
pnpm bodies:backfill --limit=20
```

`bodies:backfill` 默认跳过未到重试时间的记录。成功正文 30 天后检查，部分正文和失败记录 7 天后重试；`--retry-unavailable` 立即重试缺失正文，`--force` 强制刷新指定范围。引擎版本变化时重新处理，已明确兼容的状态迁移除外。命令每处理 20 篇保存一次校验后的快照，结束后将逐篇结果写入本地 `work/body-backfill.json`。失败原因与正文完整性状态分别记录，HTTP 成功不等于正文完整。

公开接口新增 `/data/bodies.json`，提供状态、阅读时长、目录及图片数量；`/data/bodies/{id}.json` 提供单篇清洗结果。生成的正文文件不加入代码分支。正文随完整快照进入数据分支，本地补抓不等于已经推送或部署。

## 本地验收

单元测试覆盖声明式扩展、结构化输入、脚本与事件清理、锚点、相对链接、Markdown token、失败保留、快照兼容和全文分离。浏览器测试覆盖桌面与 375px 手机的阅读布局、目录跳转、阅读进度、图片键盘预览、返回位置及正文降级。

公开内容检查始终对全文执行凭据检查。原文代码中的本地地址属于发布方内容；路径与网络地址检查只遮蔽快照校验通过、与正文完全一致的 HTML 及其序列化形式，其他页面区域继续检查。HTML、JSON 和静态导航载荷均参与扫描。

依次运行 `pnpm registry:check`、`pnpm data:check`、`pnpm test`、`pnpm build`、`pnpm typecheck`、`pnpm check:public` 和 `pnpm test:e2e`。CI 使用固定夹具，最终本地构建恢复真实快照。视觉检查同时核对深浅色、长代码和宽表格的局部滚动；报告正文成功与失败数量，不把所有条目已尝试写成所有正文已取得。
