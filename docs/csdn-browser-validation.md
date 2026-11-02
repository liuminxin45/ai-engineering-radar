# CSDN 浏览器采集验证

## 结论

2026 年 11 月 2 日，固定测试原来不可用的 114 篇 CSDN 文章，覆盖 7 个官方账号。本地 Windows 和 GitHub Actions 均最终取得 114 篇正文。建议保留 RSSHub 发现层，用 Camoufox 作为 CSDN 正文获取失败时的回退，再交给现有 HTML 解析引擎。

MagicMD 的默认 Markdown 转换在两篇华为文章中丢失了多行代码，不能直接替代现有解析引擎。浏览器取得的 HTML 包含完整代码。实验增加了代码区控件清理，以及同一代码块内多行 `<code>` 的合并，再调用现有引擎。两端各 114 份正文均通过文本、代码、图片地址和表格比对。

正式采集、数据分支和线上快照未因本实验修改。取回的正文与阅读候选页保存在本地 `work/`，没有把原始网页或全文提交到代码分支。

## 实测结果

| 项目                       | 本地 Windows | GitHub Actions Ubuntu |
| -------------------------- | -----------: | --------------------: |
| 固定文章数                 |          114 |                   114 |
| 最终取得正文               |  114（100%） |           114（100%） |
| 总访问尝试                 |          133 |                   118 |
| 首次尝试取得正文           |           98 |                   110 |
| 现有 HTML 引擎保留正文文本 |          114 |                   114 |
| 保留代码文本与换行         |          114 |                   114 |
| 保留图片地址               |          114 |                   114 |
| 保留表格数量               |          114 |                   114 |

Actions 第二轮的 114 篇都记录到了 `521 → 200` 导航。4 篇首次访问失败，在一次重试后成功。本地多数文章直接返回 200，27 篇最后一次成功访问记录到了 `521 → 200`；2 篇在两次页面完成事件超时后，通过额外补测恢复。逐篇尝试记录均保留，成功率包含这些重试。

本地测试先串行执行，之后从检查点恢复，使用两个并发上下文。Actions 分为四组，每组串行执行，组内间隔 2 秒。不同组可能使用不同网络出口，结果不能等同于单一固定出口的长期保证。

正式统计使用[第二轮 Actions](https://github.com/liuminxin45/ai-engineering-radar/actions/runs/41427958735)，执行提交为 `973c2c57698beeb44e9807b86089a7ef473e3a99`。[第一轮](https://github.com/liuminxin45/ai-engineering-radar/actions/runs/41425847603)保留了最初结果：超长截图错误覆盖了部分成功正文。修正后，截图错误单独记录；第一轮保留的证据中实际有 112 篇正文，第二轮通过重试达到 114 篇。

## 完整性口径

成功必须取得 `#content_views`，并匹配原文标题。访问检查页、空容器、RSS 摘要和明确的阅读限制不能算作完整正文。短文和单张图片正常参与比较，没有字数门槛。

HTML 路径先排除原站代码按钮、行号及展开控件。正文文本比较保留标点，仅统一 Unicode 和空白；代码另行比较原始文本与换行。图片比较来源 URL，表格比较数量，所有输出还检查脚本、表单和事件属性。这里的完整性以公开页面提供的正文容器为基准。

本地与 Actions 清洗后的正文文本也逐篇比较，114 篇全部一致。4 篇代表文章另做桌面与 375px 手机检查，共 8 次，代码换行保留，页面没有横向溢出。

图片地址保留不代表原站资源全部可用。两端都发现同一篇文章的一张公式图片加载失败，额外请求确认原站公式服务返回 HTTP 500。其公式 `alt` 文本仍保留。没有逐张下载所有图片，也没有把视频和交互组件复制为本地资源。候选页浏览器检查跳过外部媒体请求，只验证代码换行、正文结构与页面横向溢出。

### MagicMD 的转换缺口

这两篇文章的 `<pre>` 包含多个同级 `<code>`，每个节点代表一行代码：

- [告别重复手工迁仓，码道 MCP+Skill 实现仓库批量迁移](https://blog.csdn.net/devcloud/article/details/164370216)。
- [码道深度对接 CodeArts，让需求自动落地为代码](https://blog.csdn.net/devcloud/article/details/164858960)。

固定版本的[转换实现](https://github.com/didilili/MagicMD/blob/78aa27f2ffb7d541a8f65508cf5e5bde43a636e4/src/magicmd/platforms/shared/content.py#L840)对普通 `<pre>` 读取第一个直接子级 `<code>`，因此漏掉后续行。实验保留所有行，再交给现有引擎，两篇均通过代码文本与换行的比较。

另外两项 Markdown 结构提示来自原文中的说明性 `<pre>`。转换保留了其文本，但改成普通段落，不属于代码缺失。自动检查的提示和人工判断分别保留。

## 固定版本与环境

- MagicMD：`0.7.15`，提交 `78aa27f2ffb7d541a8f65508cf5e5bde43a636e4`。
- Camoufox Python：`0.5.9`。
- Camoufox 浏览器：`158.0.1-beta.41`。
- Python：`3.11`；Playwright：`1.60.0`。
- 测试集：[input.json](../scripts/csdn-probe/input.json)，带有快照哈希和每篇原始失败状态。
- 每篇使用独立上下文，复用浏览器进程。与 MagicMD 每篇启动浏览器的默认实现相比，这减少了启动成本。

两端没有使用登录 Cookie、账号、付费代理或 API Key。本地为原生 Windows 配置，使用官方浏览器二进制和本机字体。为避免下载约 1.32 GB 的跨平台字体包，本地按 ZIP 成员校验解压浏览器资源，省略原生 Windows 模式不会激活的跨平台字体；Actions 使用完整官方安装。

## 复现与证据

在实验分支根目录执行，依赖独立于正式采集器：

```powershell
py -3.11 -m venv .radar/camoufox-venv
.radar/camoufox-venv/Scripts/python.exe -m pip install --index-url https://pypi.org/simple -r scripts/csdn-probe/requirements.txt
.radar/camoufox-venv/Scripts/python.exe -m camoufox fetch official/158.0.1-beta.41
.radar/camoufox-venv/Scripts/python.exe -m unittest discover -s scripts/csdn-probe -p test_*.py
.radar/camoufox-venv/Scripts/python.exe scripts/csdn-probe/probe.py --output work/csdn-local --environment local-windows --screenshots
```

`--resume` 从逐篇检查点恢复，`--retry-failed` 在恢复时重试失败记录。`--ids` 接受逗号分隔的固定文章 ID，`--workers` 仅允许 1 或 2。页面完成事件超时时，只接受浏览器收到的完整 200 文章响应，不能使用 521 检查页或未完成的 DOM。

`render-candidates.ts` 将取得的正文送入现有解析引擎，输出逐篇 JSON、带当前阅读样式的本地 HTML 和结构比对报告。它只接受验证输出目录，不写正式快照。

```powershell
pnpm exec tsx scripts/csdn-probe/render-candidates.ts work/csdn-local work/csdn-local-html-candidates
```

汇总与逐篇结果见 [results.json](../scripts/csdn-probe/results.json)。Actions 的四份 `csdn-actions-*` artifact 包含正文、Markdown、报告和截图，保留 14 天。本地完整证据位于仓库根目录 `work/csdn-local/`、`work/csdn-actions-second/`、`work/csdn-local-html-candidates/` 和 `work/csdn-html-candidates/`。

## 接入建议

保留 RSSHub 的账号发现与第一次正文请求。只有正文请求失败或返回访问检查页时才启动 Camoufox，避免每日对成功文章重复运行浏览器。浏览器结果继续经过现有来源、标题、正文容器、清洗和快照校验。

CSDN 的控件排除与多行代码处理应进入解析层，网络获取仍独立。浏览器工作进程应复用实例、限制并发、保存逐篇检查点并有总超时。失败继续保留已有正文，在下次增量任务重试。上线前还需完成正式工作流接线和真实快照迁移；本次验证不替代这些发布步骤。

MagicMD 与 Camoufox 的用途、默认抓取方式分别参考 [MagicMD 站点支持说明](https://github.com/didilili/MagicMD/blob/78aa27f2ffb7d541a8f65508cf5e5bde43a636e4/docs/supported-sites.md)和 [Camoufox](https://github.com/daijro/camoufox)。依赖声明保留在独立的 `requirements.txt` 中。
