# 国内官方账号来源核验

核验日期：2026-11-01。首批范围为国内公司。注册表保留 17 家公司、19 个发布主体和 47 个来源入口。文章按已核实的账号建立索引，不按题材或关键词筛选。

## 身份与入口

身份核验结合企业认证、公司归属、官方自述和持续文章历史。人工核验的账号在注册表说明具体依据，不机械要求公司官网反向链接。昵称或平台名称不能单独证明身份。腾讯云、阿里云和京东云社区包含第三方投稿，保留平台参考入口，采集只指向具体账号。

官方身份、近期活跃、采集成功分别核验。能读取旧文章不代表覆盖近期更新。本轮以 2026-10-01 为近月起点，暂停 12 个过时渠道的新增采集，保留原入口、证据及历史文章。新增来源的实际采集结果以[来源验收表](source-acceptance.md)及线上来源目录为准。

| 公司   | 账号与稳定标识                                                                                                                           | 身份依据与结果                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 腾讯   | [腾讯新闻](https://news.qq.com/omn/author/8QMZ23lf74UYuTs%3D)，SUID `8QMZ23lf74UYuTs=`、媒体 ID `6093642`                                | 用户指定账号。公开资料接口返回“腾讯技术工程官方账号”认证；作者 API 解析成功。                                                                                                                                   |
| 腾讯   | [CSDN `Tencent_TEG`](https://blog.csdn.net/Tencent_TEG)、[腾讯云 UID `170434`](https://cloud.tencent.com/developer/user/170434/articles) | CSDN 最新条目为 2022-03-28，已暂停新增，腾讯新闻继续作为近期主源。腾讯云账号身份已确认，但没有目录适配器，仍只作参考。                                                                                          |
| vivo   | [CSDN `vivo_tech`](https://blog.csdn.net/vivo_tech)、[博客园 `vivotech`](https://www.cnblogs.com/vivotech/)                              | CSDN 显示“企业官方账号认证”，稳定用户名与企业标记均可读取。两平台同名团队持续发布相同文章；RSS 和账号 HTML 均成功。                                                                                             |
| 得物   | [CSDN `SmartCodeTech`](https://blog.csdn.net/SmartCodeTech)                                                                              | 本轮正常 HTTP 读取的主页 HTML 明确包含 `title="企业官方账号认证"` 的平台认证图标；成就结构化数据为“得物技术官方账号”，公司为上海得物信息集团有限公司。RSS 试采 20 条，最新 2026-10-29。不是仅凭昵称或简介启用。 |
| 阿里   | [云原生官方栏目](https://developer.aliyun.com/group/apphub/article/)，profile `pawmkwdq37c7s`                                            | 阿里云自有域名的官方博客栏目；[原文](https://developer.aliyun.com/article/1776525)明确 2026-10-29，逐篇限定阿里云云原生发布主体。                                                                               |
| 阿里   | [Dataphin 官方栏目](https://developer.aliyun.com/group/dataphin/)，profile `ylyeppx3vlhce`                                               | 官方栏目说明属于阿里云智能集团瓴羊团队；[原文](https://developer.aliyun.com/article/1777073)明确 2026-10-30。与云原生团队分别建模，避免混入或跨主体合并。                                                       |
| 阿里   | [CSDN `alitech2017`](https://blog.csdn.net/alitech2017)                                                                                  | 原企业认证依据保留，但最新 2024-09-13，已暂停新增。                                                                                                                                                             |
| 字节   | [火山引擎“字节跳动开源”](https://developer.volcengine.com/user/1333053764416295)                                                         | 自有社区稳定账号 `1333053764416295`；[原文](https://developer.volcengine.com/articles/7698691370294181915)署名字节跳动 STE 团队，公开 SSR 的作者 ID 与发布时间对应 2026-10-20。限定此账号，不认领火山引擎整站。 |
| 字节   | [CSDN `ByteDanceTech`](https://blog.csdn.net/ByteDanceTech)                                                                              | 最新 2024-04-16，已暂停新增。原开源官网继续保留为参考入口。                                                                                                                                                     |
| 百度   | [CSDN `weixin_45449540`](https://blog.csdn.net/weixin_45449540)                                                                          | 原企业官方账号依据保留，但最新 2026-05-28，已暂停新增。近期百度智能云文章已找到，作者归属仍待核验，不因自有托管域名自动认领。                                                                                   |
| 华为   | [CSDN `devcloud`](https://blog.csdn.net/devcloud)                                                                                        | 页面标注华为云官方博客；[企业微博](https://weibo.com/esdk)列出 CSDN 渠道。RSS 成功。                                                                                                                            |
| 快手   | [CSDN `kuaishoutech`](https://blog.csdn.net/kuaishoutech)、[思否 `kuaishoujishu`](https://segmentfault.com/blog/kuaishoujishu)           | CSDN 最新 2026-10-15，为沙龙报名，仍不保证公众号技术文章完整同步。思否最新 2026-04-07，已暂停新增。旧 CSDN `Kwai_tech` 已注销，未接入。                                                                         |
| 蚂蚁   | [思否 `ant-techfin`](https://segmentfault.com/blog/ant-techfin)                                                                          | 官方身份依据保留，但最新 2024-04-22，已暂停新增。`AntResearch` 身份依据不足，保持待核验。官方开源站存在列表日期与后台时间冲突，不能据此宣称近期活跃。                                                           |
| OPPO   | [思否 `oppotech`](https://segmentfault.com/blog/oppotech)                                                                                | 官方身份依据保留，但最新 2022-04-06，已暂停新增。已找到“安第斯智能云”账号迁移线索，尚未确认近月原文。                                                                                                           |
| 小米   | [掘金 `676954893719742`](https://juejin.cn/user/676954893719742)、[信息部团队博客](https://xiaomi-info.github.io/)                       | 掘金旧号已声明迁移；团队博客最新 2020-05-24，已暂停新增。`tech.mi.com` 与 MiMo 是官方替代方向，但目录和原文日期待交叉核验、客户端目录尚未适配。CSDN `pengzhouzhou` 身份不足，未启用。                           |
| 京东   | [博客园 `Jcloud`](https://www.cnblogs.com/Jcloud/)                                                                                       | 京东云开发者账号的团队署名和历史，与[京东云开发者社区](https://developer.jdcloud.com/)及同名公众号相互印证。账号 HTML 成功。                                                                                    |
| 携程   | [CSDN `ctrip_tech`](https://blog.csdn.net/ctrip_tech)                                                                                    | 最新 2026-05-13，已暂停新增。公众号 `ctriptech` 身份有官方技术合辑支持，近期文章仍缺可独立核验的原始链接和日期；历史博客园未启用。                                                                              |
| 网易   | [CSDN `wangyiyungw`](https://blog.csdn.net/wangyiyungw)、[博客园 `163yun`](https://www.cnblogs.com/163yun/)                              | CSDN 最新 2026-10-28，继续使用；博客园最新 2026-09-10，已暂停新增。仅代表网易智企、数帆发布主体，不保证覆盖所有网易团队。                                                                                       |
| 小红书 | [CSDN `REDtech_1024`](https://blog.csdn.net/REDtech_1024)                                                                                | [团队首发公告](https://juejin.cn/post/7218758481577984056)身份依据保留，但最新 2024-07-02，已暂停新增。近期微信原始链接已定位，原站要求验证码，尚未核实日期，不启用第三方镜像。                                 |
| B站    | [CSDN `bilibili_TC`](https://blog.csdn.net/bilibili_tc)、[掘金 `3030701626893405`](https://juejin.cn/user/3030701626893405)              | 掘金列出上海哔哩哔哩科技有限公司；年度内容合集和持续文章历史一致。RSS 成功，实际作者标识大小写为 `bilibili_TC`。                                                                                                |

美团自有技术站继续采集。得物官网首页最新文章止于 2026-07-13，本轮暂停新增并保留历史，以企业认证的 CSDN 账号补足近期更新。得物腾讯云专栏 `96340` 的 UID 为 `9927536`，平台职业认证标志为 0，继续关闭采集。

## 允许采集的通道

- CSDN 账号 RSS：`https://rss.csdn.net/<账号>/rss/map`。公开 robots 允许请求。每篇同时校验作者用户名、文章账号路径和已审核主机。部分主页 HTML 返回 HTTP 521，不伪装浏览器或处理挑战；已验证的公开 RSS 可独立使用。
- 腾讯新闻：`https://i.news.qq.com/getSubNewsMixedList`，以给定 SUID 的公开作者目录为请求目标。逐条校验 `card.suid`，不按显示昵称认领文章。原文链接使用真实文章 ID 对应的腾讯新闻地址，已验证首篇原文可访问。
- 博客园：账号 HTML 列表允许访问。部分 `/rss` 入口跳转到 `feed.cnblogs.com`，该主机 robots 禁止相关路径，停止请求并改用允许的账号列表。解析时校验账号路径，分别提取每篇的标题、摘要和时间。
- 阿里云官方栏目：只读取审核过的 `group` 目录，逐条匹配稳定 profile ID；云原生与 Dataphin 分别关联发布主体。
- 火山引擎账号：公开账号 SSR 中的文章必须关联审核过的稳定作者 ID，使用真实发布时间，不按平台域名认领作者。
- 思否和小米历史团队博客：旧适配器保留以便恢复与审计，目前暂停新增。其 Feed 常包含全文，始终忽略正文。

CSDN 与全文型账号 Feed 不补抓文章 HTML，避免列表摘要缺失引发逐篇请求。其他来源沿用原有的元数据补充逻辑。没有日期时保留缺失，不用更新时间冒充发布日期。

## 验证范围与限制

本轮注册表新增 4 个来源，暂停 12 个过时来源，剩余 13 个来源启用。得物企业认证来自正常公开 HTTP 响应的真实标签；其公开 RSS 已只读试采。阿里两处官方目录和字节原文的账号、日期已核验，专用适配器与逐篇作者反例测试随代码维护。完整采集、构建和部署结果由统一发布流程验证，不以登记配置或网页返回 200 代替成功。

历史来源仍能提供文章索引，但不代表持续更新。小米的新技术站与部分掘金账号为客户端渲染页面，尚未核实稳定公开目录接口。未采用登录、验证码、第三方公众号镜像或反爬绕过方式补足这些入口。
