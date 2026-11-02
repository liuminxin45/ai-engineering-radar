<p><img src="apps/web/public/brand/logo.svg" width="300" height="100" alt="AI Engineering Radar" /></p>

聚合一线团队的 AI 工程实践，让值得学习的经验更容易被发现和持续追踪。

[阅读看板](https://liuminxin45.github.io/ai-engineering-radar/) · [关于](https://liuminxin45.github.io/ai-engineering-radar/about/) · [RSS](https://liuminxin45.github.io/ai-engineering-radar/feed.xml) · [Atom](https://liuminxin45.github.io/ai-engineering-radar/feed.atom)

AI Engineering Radar indexes official engineering blogs from Chinese companies, with company columns, search, source evidence, and RSS / Atom feeds.

## 适合怎样的阅读需求

想持续跟踪国内公司的工程实践，可以按公司浏览博文，也可以订阅全站更新。这里保留原文入口和发布主体证据，方便从索引回到原始材料。

收录范围以注册表中的具体团队为准，不代表覆盖集团全部内容。采集计划可能延迟，缺失记录也不代表原团队没有更新。

## 为什么做这个项目

一线团队的技术博客，记录了 AI 走进真实业务的探索、架构取舍和实践经验。这些内容分散在公司官网、开发者社区和团队账号里，持续跟进费时，有价值的文章也容易被错过。

AI Engineering Radar 将这些发布渠道聚集起来，帮助开发者发现新实践、追踪团队更新，并从中找到解决具体工程问题的思路。

## 核心功能

- 博文按公司分列，集中查看最新内容。
- 多列并排阅读，支持公司导航和滚动加载。
- 搜索标题、摘要和作者，快速查找相关经验。
- 支持全站 RSS / Atom 订阅，持续追踪更新。
- GitHub Actions 每日定时采集并发布，计划于北京时间 09:17 运行。
- 阅读状态保存在链接中，支持刷新恢复与分享。
- 博文在本站统一排版阅读，支持目录、阅读进度和图片放大，顶部可打开原文。
- 支持深浅色切换，点击文章标题直达原文。

## 阅读界面

![多面板阅读看板](docs/images/board-desktop.png)

## 收录来源

### 博文

| 公司              | 来源入口                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- |
| 腾讯              | [腾讯技术工程 · 腾讯新闻](https://news.qq.com/omn/author/8QMZ23lf74UYuTs%3D)              |
| 得物              | [得物技术 · 腾讯云](https://developer.cloud.tencent.com/user/9927536/articles)            |
| 阿里巴巴 / 阿里云 | [阿里云云原生 · 云原生应用开发与管理](https://developer.aliyun.com/group/apphub/article/) |
| 千问              | [千问 · Research](https://qwen.ai/research)                                               |
| 字节跳动          | [字节跳动技术团队 · 火山引擎](https://developer.volcengine.com/user/2772312065061673)     |
| 美团              | [美团技术团队](https://tech.meituan.com/)                                                 |
| vivo              | [vivo 互联网技术 · CSDN](https://blog.csdn.net/vivo_tech)                                 |
| 华为              | [华为云开发者联盟 · CSDN](https://blog.csdn.net/devcloud)                                 |
| 快手              | [快手技术 · CSDN](https://blog.csdn.net/kuaishoutech)                                     |
| 网易              | [网易数帆大数据 · CSDN](https://blog.csdn.net/wangyiyungw)                                |
| B站               | [哔哩哔哩技术 · CSDN](https://blog.csdn.net/bilibili_TC)                                  |
| 京东              | [京东云开发者 · 博客园](https://www.cnblogs.com/Jcloud/)                                  |
| 百度              | [百度智能云技术站 · CSDN](https://blog.csdn.net/2301_82040283)                            |
| 蚂蚁集团          | [蚂蚁数据 AntData · CSDN](https://devpress.csdn.net/user/DB_GPT)                          |

欢迎[提议新来源](https://github.com/liuminxin45/ai-engineering-radar/issues/new?template=source.yml)或[提交贡献](CONTRIBUTING.md)。

## 许可与内容版权

主应用代码采用 [MIT](LICENSE)，独立的 [RSSHub 服务](services/rsshub/)采用 [AGPL-3.0](services/rsshub/LICENSE)。来源文章、图片、摘要、名称和商标归相应权利人所有，不因本项目开源而重新授权。阅读页保留作者、发布主体和原文入口；正文不可用或可能不完整时明确提示，内容更新以原文为准。权利人可通过仓库 Issue 请求更正或移除。

博文正文解析参考了 [简悦 SimpRead](https://github.com/Kenshin/simpread) 的[站点解析规则](https://github.com/Kenshin/simpread/blob/d6534a7d67ab606e0390ff7172360fac88af4422/src/website_list.json)，感谢 Kenshin 与项目贡献者。解析引擎、扩展方法和参考版本见[阅读页维护说明](docs/article-reader.md)。

CSDN 账号的文章发现与可用正文获取接入了 [RSSHub](https://github.com/DIYgod/RSSHub)，感谢 DIYgod 与项目贡献者。接入范围和正文限制见[RSSHub 维护说明](docs/rsshub.md)。
