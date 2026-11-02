# 可选标题评分与 Provider 池

标题评分仅为博文提供阅读参考。它不改变收录、排序、搜索或订阅，也不判断正文质量。论文不评分。软文规则和人工更正先执行，最终为 `suspected` 的文章不请求评分，列表继续显示原有“疑似软文”标签。

## 配置和运行

`config/scoring-providers.json` 保存公开配置，实际密钥只从环境变量读取。首个 provider 使用 OpenCode 的免费 `jev-1.13-free`，不自动切换付费模型。

在仓库 Settings → Secrets and variables → Actions → New repository secret 创建 `OPENCODE_API_KEY`，值为 OpenCode Console API Key。创建入口：<https://github.com/liuminxin45/ai-engineering-radar/settings/secrets/actions/new>。密钥仅注入发布工作流的评分步骤，不传给构建或浏览器，也不写入快照和日志。

本地 PowerShell 使用会话环境变量注入 Key，再运行：

```powershell
$env:RADAR_DATA_DIR = ".radar/data"
pnpm score:titles
pnpm data:check
pnpm build
```

命令不会自动加载 `.env`。未设置密钥时可以直接运行，程序会跳过评分并保留文章。不要在聊天、仓库或命令历史中填写真实密钥。

Actions 顺序为恢复快照、可选采集、评分、构建验证、保存快照和发布。关闭 `collect` 仍会对现有文章补评分。首次处理所有缺少有效评分的公开博文，最新优先；超出本轮预算的条目留待下次处理。

验证真实接入时，手动运行 **Collect and publish**，选择待验证分支并开启 `validate_scoring`。此模式只读取现有快照，从软文判定和人工更正后的公开博文中选取 128 条，要求一次请求返回全部答案且顺序映射及百分制转换正确。它不拆批、不回退、不修改数据，也不部署网站；失败会明确标红，避免将可选层的正常跳过当成验证通过。成功报告位于该次运行的 `scoring-validation` Artifact。

同一严格检查也可在已注入 Key 的环境运行 `pnpm score:verify-live`。正常发布仍使用可选回退模式，只有 `main` 分支可以执行发布任务。

## 池调度

每项配置包含 `id`、`adapter`、`displayName`、`enabled`、`priority`、`model` 和 `apiKeyEnv`。ID 不可重复；优先级越小越优先，同优先级按批次轮询。只有启用项进入池。

- 缺少密钥、认证失败、额度耗尽或请求配置错误：本次运行停用该项。
- 限流：按 `Retry-After` 冷却，未提供时为 60 秒。
- 网络故障、超时、服务故障或缺失/无效答案：冷却 60 秒。
- 当前项不可用时立即尝试下一项。每批对同一项只选择一次；请求过大时允许拆成更小子批次。
- 全部不可用时立即跳过剩余评分，不等待恢复。冷却与停用状态不跨运行保存。

默认批次 128，单请求超时 20 秒，整轮预算 120 秒，串行调用。配置分别为 `batchSize`、`requestTimeoutMs` 和 `budgetMs`。请求过大时二分重试，最小一条；已取得的有效结果保留。部分缺失时，只将未完成标题交给下一项。单条也过大时，该条可由后续 provider 尝试。

评分模块使用通用 `ScoringProvider.scoreBatch(items, rubric, signal)`，返回带输入 ID、百分制整数分数和模型的结果。新服务只需新增适配器、注册配置类型，再添加配置项和对应的 Actions Secret 注入。适配器负责协议、响应校验和转换，使用 `ProviderError` 报告统一错误类别；池调度和采集流程无需依赖新服务协议。不同适配器可声明自己的 `maxBatchSize`。

池配置可以为空或全部关闭。配置文件错误、快照损坏和人工更正错误仍应修复并通过校验；外部评分请求不可用不会导致任务失败。不使用整个评分步骤的 `continue-on-error` 掩盖数据错误。

## Jev 请求与评分含义

接口使用 OpenCode 的 `https://opencode.ai/inference/systemone/v1/systemone`，认证为 Bearer Key。请求只包含评分说明和标题数组，不传公司、URL、摘要或正文。每个标题对应一个 `score` 问题，说明明确引用标题下标；响应根据问题 ID 对齐，再还原输入顺序。Jev 返回的是具名答案对象，并非生成式数字文本或保证有序的响应数组。

评分标准保存在 `packages/scoring/rubric.ts`，包含 AI 相关性、真实工程应用、技术实践深度及用户确认的六档说明。Jev 的原始 `score` 是分档位置，六档为 0–5；百分制使用 `round(rawScore / 5 × 100)`，因此原始 4.15 对应 83 分。转换后的分数是阅读参考，不是人工校准后的质量测量。

标题不明确时保守评分；热门模型、公司知名度和夸张文案不加分。普通工具使用教程不等同真实工程实践。当前没有按 60 或 75 分筛选文章，后续若需使用阈值，应先用人工标注标题校准。

参考：[OpenCode Jev 文档](https://dev.opencode.ai/v2/docs/console/models#jev)、[TypeSafe Score 定义](https://docs.typesafe.ai/primitives/score)。免费服务可用性及 128 标题真实请求通过上述严格检查验证。

## 缓存、展示与回退

文章的可选 `readingScore` 保存 `score`、`titleHash`、`rubricVersion`、`provider`、`displayName`、`model` 和 `scoredAt`。旧快照缺少该字段时仍能读取。评分随原有校验和快照保存，静态文章 JSON 公开这些结果，不公开密钥。

标题哈希或评分版本变化时，旧分失效并等待重评。摘要、作者、发布时间和正文补抓变化不会触发重评；每日无新标题且缓存有效时不请求评分服务。调整池的顺序、启停项或替换模型不会强制重评历史文章；需要重新评分时升级评分版本。修改评分说明、分档或换算方式必须升级版本。有效缓存不因服务故障消失。

列表右下角显示服务名称和分数，例如 `Jev 83`。标签无下划线或悬浮提示。没有有效分数时不显示评分标签，包括请求失败或服务不可用时，不显示“打分失败”“待评分”或零分占位。导出还会重新检查软文状态、内容类型和缓存版本，确保未经评分步骤的重新构建也不会展示失效结果。

停止评分时，将所有 provider 关闭；已有效的分数仍可作历史参考。需要移除分数时可撤销评分功能并重新构建，文章原有身份和发布状态保持兼容。日志与 Actions Summary 只记录计数、provider ID 和错误类别，不输出远端响应、标题或凭据。
