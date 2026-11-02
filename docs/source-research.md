# 国内官方账号来源核验

核验日期：2026-11-02。当前注册表覆盖 17 家公司，每家公司只登记一个来源，共 17 个来源。14 个启用，OPPO、携程和小红书的 3 个历史源暂停新增。

## 每家公司只保留一个来源

按维护者要求，唯一来源约束覆盖整家公司，不按发布主体拆分名额。禁用入口和身份参考入口同样占用来源名额；额外证据链接保存在来源的核验说明中，不单独登记为来源。

来源选择优先尊重维护者指定，其次考虑身份依据、实际采集结果、近期更新和内容覆盖。得物沿用指定的腾讯云用户文章页，小米沿用 MiMo 官网。vivo 保留企业 CSDN，已有快照覆盖 20 篇；阿里保留阿里云云原生官方栏目，蚂蚁保留百灵官网博客。这两家只代表当前选定团队的内容，不承诺覆盖集团全部技术文章。

| 公司 | 唯一来源 | 来源 ID | 状态 |
| --- | --- | --- | --- |
| 美团 | [美团 · meituan](https://tech.meituan.com/) | meituan | 启用 |
| vivo | [vivo互联网技术 · CSDN](https://blog.csdn.net/vivo_tech) | vivo-csdn | 启用 |
| 得物 | [得物技术 · 腾讯云](https://developer.cloud.tencent.com/user/9927536/articles) | dewu-tencent | 启用 |
| 腾讯 | [腾讯技术工程 · 腾讯新闻](https://news.qq.com/omn/author/8QMZ23lf74UYuTs%3D) | tencent-qqnews | 启用 |
| 阿里巴巴 / 阿里云 | [阿里云云原生 · 官方博客](https://developer.aliyun.com/group/apphub/article/) | aliyun-cloud-native | 启用 |
| 字节跳动 | [字节跳动开源 · 火山引擎](https://developer.volcengine.com/user/1333053764416295) | bytedance-volcengine | 启用 |
| 百度 | [百度智能云技术站 · CSDN](https://blog.csdn.net/2301_82040283) | baidu-cloud-csdn-candidate | 启用 |
| 华为 | [华为云开发者联盟 · CSDN](https://blog.csdn.net/devcloud) | huawei-csdn | 启用 |
| 快手 | [快手技术 · CSDN](https://blog.csdn.net/kuaishoutech) | kuaishou-csdn | 启用 |
| 蚂蚁集团 | [蚂蚁百灵 · 官方博客](https://developer.ant-ling.com/zh-CN/blogs) | ant-ling | 启用 |
| 小米 | [小米 MiMo · 官方博客](https://mimo.xiaomi.com/) | xiaomi-tech-site | 启用 |
| OPPO | [OPPO数智技术 · 思否](https://segmentfault.com/blog/oppotech) | oppo-segmentfault | 暂停新增，保留历史 |
| 京东 | [京东云开发者 · 博客园](https://www.cnblogs.com/Jcloud/) | jd-cnblogs | 启用 |
| 携程 | [携程技术 · CSDN](https://blog.csdn.net/ctrip_tech) | ctrip-csdn | 暂停新增，保留历史 |
| 小红书 | [小红书技术REDtech · CSDN](https://blog.csdn.net/REDtech_1024) | xiaohongshu-csdn | 暂停新增，保留历史 |
| 网易 | [网易数帆大数据 · CSDN](https://blog.csdn.net/wangyiyungw) | netease-csdn | 启用 |
| B站 | [哔哩哔哩技术 · CSDN](https://blog.csdn.net/bilibili_TC) | bilibili-csdn | 启用 |

## 身份与采集边界

公司归属按发布主体核验，不按托管平台域名推断。身份核验结合公司自有域名、平台企业认证、官方自述和连续文章历史。具体证据与日期保存在注册表及[来源验收表](source-acceptance.md)。用户指定的得物账号记录公开账号内容依据，不将其写成平台职业认证。

CSDN RSS 按作者用户名、已审核主机和文章账号路径匹配。腾讯新闻逐条校验稳定 SUID。腾讯云用户目录逐篇核对作者 UID。阿里云官方栏目逐篇核对作者 profile，火山引擎目录核对稳定作者 ID。京东博客园使用账号文章路径和逐篇日期。百灵与 MiMo 仅采官网指定博客目录，不保存全文。

官方身份、近期活跃和采集成功分别核验。HTTP 200 不等于成功取得文章。没有原始日期时保留缺失，不把采集时间或更新时间当作发布日期。访问受限、需要登录或验证码的入口不会绕过限制。当前采集结果以[来源验收表](source-acceptance.md)及[公开来源 JSON](https://liuminxin45.github.io/ai-engineering-radar/data/sources.json)为准。

## 本次收敛与数据迁移

本次从 38 个来源收敛为 17 个，移除 21 个额外入口，包括 18 个参考入口，以及 vivo 博客园、Dataphin 和 OceanBase 的 3 个采集源。vivo CSDN、阿里云云原生和蚂蚁百灵均已重新真实采集成功。

迁移移除额外来源的状态与文章位置。仅由移除来源支撑的 130 篇文章退出当前快照，仍有保留来源位置的文章保留原 ID。当前发布快照为 429 篇文章。发布时另从最新远端数据重做迁移，保留线上已有的试运行标记。参考入口必须没有文章历史；存在文章时迁移会失败，防止误删。移除曾采集的来源仍须先验证保留源已启用、身份已核验，并有成功状态和已发布文章。

注册表加载时校验每家公司恰好一个来源。同一公司的另一个发布主体、禁用参考入口和论文来源均不能另占名额；混合内容应由唯一来源的适配器返回类型信息。新增来源必须替换该公司现有入口，或属于新注册的公司。

## 历史调查与限制

[第二轮调查记录](source-research-round2.md)保留了此前对多个候选渠道的身份、可达性和日期调查，属于历史证据；当前启用状态以本页和注册表为准。Dataphin、OceanBase、快手 InfoQ 及其余参考入口已从当前注册表移除。

OPPO、携程和小红书仍无已验证的近期可持续采集入口，保留唯一历史源并暂停新增。MiMo 最新明确发布日期为 2026-09-27，按维护者指定继续追踪。快手当前源最新条目为活动报名，不保证技术长文覆盖完整。完整构建、浏览器验收和部署结果由各自验证记录说明。
