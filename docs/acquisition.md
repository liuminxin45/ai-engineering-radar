# 网页获取层维护

## 分层与接口

发现层产生文章元数据和原文位置。CSDN 使用独立 RSSHub 服务读取已核验账号的订阅，其他来源沿用各自适配器。`collectBodies` 根据快照选择新增、变化、失败及规则升级的正文。成功且未变化的记录继续跳过。

获取层位于 `packages/crawler/acquisition/`。`DocumentProvider` 返回 `AcquiredDocument`：原文 URL、内容、格式及可选的发布方片段标识。提供器不写快照，也不依赖正文解析器。

`acquireWithFallback` 依次调用提供器，把结果交给调用方的验收函数。网络失败、访问检查页、正文容器缺失和标题不符都会进入下一种获取方式。全部失败时，正文任务保留已有内容并记录失败，在下次增量采集时重试。

CSDN 编排位于 `packages/crawler/platforms/csdn-body.ts`，组合普通 HTTP、浏览器提供器和解析器。更换网络实现只需提供相同的文档接口。增加站点时，先建立目标校验与编排，再复用通用接口。

解析层 `packages/article-parser/` 不发送网络请求。CSDN 规则 v3 清理代码按钮、行号及展开控件，`csdn.ts` 将多行节点和高亮行重建为代码文本，移除渲染注释但保留源码与换行。清洗后再次检查代码保留情况。获取方式变化不会改变目录、快照及阅读页接口。

快照中可选的 `acquisition` 保存最终提供器和各次提供器尝试的成功或失败状态，不包含代理地址、Cookie 或原始页面。旧快照仍能读取。原始网页在内存中处理，数据分支只保存清洗后正文。

## 浏览器服务

`services/browser-fetch/` 是独立 Python 进程，默认仅监听 `127.0.0.1:1201`。HTTP 协议版本为 1：

| 接口           | 作用                                                            |
| -------------- | --------------------------------------------------------------- |
| `GET /healthz` | 服务进程及配置版本，不代表已成功抓取文章                        |
| `POST /fetch`  | 请求体为 `{"url":"已登记的 CSDN 原文地址"}`，返回统一 HTML 文档 |

`policy.py` 从注册表读取已启用、已核验的 CSDN 账号，只接受这些账号下的数字文章 ID。主采集器再次检查返回地址、标题、正文容器和清洗结果。主页面导航必须留在同一篇文章，显式私有地址的资源请求会被拒绝。接口不提供任意 URL 代理。

`camoufox_backend.py` 创建 Camoufox。`runtime.py` 管理浏览器生命周期、上下文、并发和重试。HTTP 服务不包含 Markdown 转换、正文解析或快照代码。可以替换后端工厂，或实现相同 HTTP 协议，主采集器继续使用统一文档接口。

浏览器在第一次需要回退时启动，同一任务中复用，最多同时运行两个上下文。每个请求最多尝试两次，总时间限制为 120 秒，包含排队时间；调用方超时为 125 秒。上下文在成功、异常和取消后关闭。截图不参与正式采集。

页面完成事件超时时，服务可读取浏览器已收到的完整 200 文章响应。521 检查页、未完成响应或缺少正文容器的页面不能算成功。原始 HTML 上限为 8 MiB，网络响应和清洗后正文分别校验。

## 本地运行

需要 Node.js 24.19.0、pnpm 10.20.0 和 Python 3.11。Python 依赖与主应用独立安装：

```powershell
py -3.11 -m venv .radar/browser-venv
.radar/browser-venv/Scripts/python.exe -m pip install --index-url https://pypi.org/simple -r services/browser-fetch/requirements.txt
.radar/browser-venv/Scripts/python.exe -m camoufox fetch official/158.0.1-beta.41
.radar/browser-venv/Scripts/python.exe services/browser-fetch/server.py
```

另开终端启动 RSSHub，见 [RSSHub 维护](rsshub.md)。再向采集进程注入服务地址：

```powershell
$env:RSSHUB_URL="http://127.0.0.1:1200"
$env:BROWSER_FETCH_URL="http://127.0.0.1:1201"
pnpm ingest --daily
```

命令行不会自动读取 `.env`。`BROWSER_FETCH_PORT` 修改服务端口，`BROWSER_PROXY_URL` 仅供浏览器服务读取。代理凭据只放环境变量。`CAMOUFOX_EXECUTABLE_PATH` 可指定已安装的官方浏览器二进制，实际版本仍须符合固定版本。未配置 `BROWSER_FETCH_URL` 时，兼容原有 HTTP 获取路径。

## Actions 与正式数据

**Collect and publish** 采集任务安装固定的 Camoufox Python、Playwright 和浏览器版本，缓存浏览器文件，启动两个服务，再执行正式 `pnpm ingest --daily`。关闭 `collect` 时，仅从现有快照发布，不启动采集服务。

当前 CSDN 规则为 v3，兼容旧 `rsshub-csdn` 标识。v1 需要重新获取原文；v2 的已清洗代码可离线重建，不修改采集时间，只有带空代码块的记录标记为待刷新。其他来源的成功正文继续跳过，v3 的成功正文也保持增量跳过行为。

采集、数据校验、构建、公开内容检查及浏览器验收通过后，工作流才提交 `data` 分支并部署 Pages。服务地址和浏览器依赖不进入前端。上线后同时核对 `/data/bodies.json`、单篇正文的 `acquisition` 记录与阅读页，不能只确认工作流启动成功。

服务单元测试不需要真实浏览器：

```powershell
py -3.11 -m unittest discover -s services/browser-fetch -p test_*.py
pnpm test
```

## 验证与参考

接入前，本地与 Actions 分别验证同一批 114 篇历史失败文章，最终都取得 114 篇正文。两端经 HTML 清洗后的文本逐篇一致，代码、换行、图片地址和表格均保留。见[固定版本验证报告](https://github.com/liuminxin45/ai-engineering-radar/blob/15c1c8e/docs/csdn-browser-validation.md)。正式切换以本次采集后的数据分支、部署及线上检查为准。

获取思路参考 [MagicMD](https://github.com/didilili/MagicMD) 的 Camoufox 用法。实测发现，其 Markdown 转换会漏掉部分 CSDN 多行代码，因此正式服务直接返回 HTML，继续使用本站解析层。MagicMD 不属于正式运行依赖。

本服务代码按根目录 MIT 许可维护。Camoufox Python 采用 MIT，浏览器代码及包内资源遵循上游 MPL-2.0 和第三方声明。RSSHub 服务继续独立采用 AGPL-3.0，不导入本服务或主采集器。
