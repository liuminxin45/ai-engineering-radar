# 论文来源与公司归属核验

核验日期：2026-11-02。本轮真实快照收录 412 篇论文，覆盖当前 14 家公司，其中 7 篇涉及多家已注册公司。博文保持每家公司最多一个可用渠道，论文按独立的出版或研究渠道核验。

## 收录依据

- 正式出版物使用 Crossref 的出版方元数据，只读取作者机构字段。查询命中后仍须严格匹配公司名称及已核实的机构别名，不按标题、摘要、邮箱或托管域名推断。
- 预印本渠道核对机构主页稳定账号，再读取论文首页作者署名。只看公司在作者区的署名，不扫描正文和参考文献。HTML 无法提供机构证据时跳过，不能将提交人或个人资料当作署名。
- ByteDance Seed 和华为诺亚的公司自有研究目录直接列出本团队成果，可作为所属公司的参与依据。这类记录标为 `official-directory`，与作者机构证据分别保存。
- 每篇论文均保存 `companyIds` 和 `paperAffiliations`，证据字段包括公司 ID、URL、方式和短摘录。归属对应论文发表时的机构记录，不表示作者当前任职。

## 本轮覆盖

下表是本次已验证快照，联合论文会计入多个公司的列。列内数量之和高于全站唯一论文数；后续数据更新以公开 JSON 为准。

| 公司              | 归属论文数 | 原始论文示例                                                             | 归属证据示例                                                                                  |
| ----------------- | ---------: | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 美团              |         32 | [原文](https://doi.org/10.1145/3805712.3809750)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3805712.3809750)                          |
| vivo              |         30 | [原文](https://doi.org/10.36227/techrxiv.176107519.98547757/v1)          | [机构记录](https://api.crossref.org/works/10.36227%2Ftechrxiv.176107519.98547757%2Fv1)        |
| 得物              |          2 | [原文](https://doi.org/10.1145/3701716.3715218)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3701716.3715218)                          |
| 腾讯              |         35 | [原文](https://doi.org/10.1145/3746027.3754698)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3746027.3754698)                          |
| 阿里巴巴 / 阿里云 |         32 | [原文](https://doi.org/10.1145/3799902.3811149)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3799902.3811149)                          |
| 千问              |          0 | —                                                                        | 待取得独立机构证据                                                                            |
| 字节跳动          |         50 | [原文](https://doi.org/10.1145/3819238)                                  | [机构记录](https://api.crossref.org/works/10.1145%2F3819238)                                  |
| 百度              |         33 | [原文](https://doi.org/10.1145/3805712.3809941)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3805712.3809941)                          |
| 华为              |         41 | [原文](https://doi.org/10.1145/3770855.3817663)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3770855.3817663)                          |
| 快手              |         30 | [原文](https://doi.org/10.1145/3773078.3831930)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3773078.3831930)                          |
| 蚂蚁集团          |         35 | [原文](https://doi.org/10.1145/3799902.3811149)                          | [机构记录](https://api.crossref.org/works/10.1145%2F3799902.3811149)                          |
| 京东              |         30 | [原文](https://doi.org/10.1109/itherm55368.2023.10177639)                | [机构记录](https://api.crossref.org/works/10.1109%2Fitherm55368.2023.10177639)                |
| 携程              |         10 | [原文](https://doi.org/10.1145/3239546)                                  | [机构记录](https://api.crossref.org/works/10.1145%2F3239546)                                  |
| 网易              |         31 | [原文](https://doi.org/10.1109/iccv51701.2025.01639)                     | [机构记录](https://api.crossref.org/works/10.1109%2Ficcv51701.2025.01639)                     |
| B站               |         30 | [原文](https://doi.org/10.1109/cvprw53098.2021.00030)                    | [机构记录](https://api.crossref.org/works/10.1109%2Fcvprw53098.2021.00030)                    |

千问是后续新增的独立品牌栏目，现有官方 Research 内容继续保留。论文暂不将阿里署名自动转归千问；独立作者机构证据未确认的预印本已隐藏。

## 采集渠道与结果

14 家公司均有 Crossref 正式出版物渠道。本轮保留 23 个论文入口，均启用并经实采与机构复核。Qwen、Kling、JoyAI 与 Index 的 4 个参考入口已按维护者要求移除，历史候选也退出当前快照。除正式出版渠道外，已成功接入腾讯混元、ByteDance Seed、百度、美团 LongCat、蚂蚁的机构论文页，ByteDance Seed 与华为诺亚的官方论文目录，以及直接核验的 TripScore 和 AAAI 联合论文记录。

| 入口                                                                                                                              | 启用 | 本轮状态 | 说明                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- | ------------------------------------------------------------ |
| [meituan-papers-crossref](https://api.crossref.org/works?query.affiliation=Meituan&sort=published&order=desc&rows=100)            | 是   | success  | 已取得可核验的论文元数据                                     |
| [vivo-papers-crossref](https://api.crossref.org/works?query.affiliation=vivo+Mobile+Communication&sort=score&order=desc&rows=100) | 是   | success  | 已取得可核验的论文元数据                                     |
| [dewu-papers-crossref](https://api.crossref.org/works?query.affiliation=Dewu&sort=published&order=desc&rows=100)                  | 是   | success  | 已取得可核验的论文元数据                                     |
| [tencent-papers-crossref](https://api.crossref.org/works?query.affiliation=Tencent&sort=published&order=desc&rows=100)            | 是   | success  | 已取得可核验的论文元数据                                     |
| [alibaba-papers-crossref](https://api.crossref.org/works?query.affiliation=Alibaba&sort=published&order=desc&rows=100)            | 是   | success  | 已取得可核验的论文元数据                                     |
| [bytedance-papers-crossref](https://api.crossref.org/works?query.affiliation=ByteDance&sort=published&order=desc&rows=100)        | 是   | success  | 已取得可核验的论文元数据                                     |
| [baidu-papers-crossref](https://api.crossref.org/works?query.affiliation=Baidu&sort=published&order=desc&rows=100)                | 是   | success  | 已取得可核验的论文元数据                                     |
| [huawei-papers-crossref](https://api.crossref.org/works?query.affiliation=Huawei&sort=published&order=desc&rows=100)              | 是   | success  | 已取得可核验的论文元数据                                     |
| [kuaishou-papers-crossref](https://api.crossref.org/works?query.affiliation=Kuaishou&sort=published&order=desc&rows=100)          | 是   | success  | 已取得可核验的论文元数据                                     |
| [ant-papers-crossref](https://api.crossref.org/works?query.affiliation=Ant+Group&sort=score&order=desc&rows=100)                  | 是   | success  | 已取得可核验的论文元数据                                     |
| [jd-papers-crossref](https://api.crossref.org/works?query.affiliation=JD.com&sort=score&order=desc&rows=100)                      | 是   | success  | 已取得可核验的论文元数据                                     |
| [ctrip-papers-crossref](https://api.crossref.org/works?query.affiliation=Ctrip&sort=published&order=desc&rows=100)                | 是   | success  | 已取得可核验的论文元数据                                     |
| [netease-papers-crossref](https://api.crossref.org/works?query.affiliation=NetEase&sort=published&order=desc&rows=100)            | 是   | success  | 已取得可核验的论文元数据                                     |
| [bilibili-papers-crossref](https://api.crossref.org/works?query.affiliation=Bilibili&sort=published&order=desc&rows=100)          | 是   | success  | 已取得可核验的论文元数据                                     |
| [seed-hf-papers](https://huggingface.co/ByteDance-Seed/papers)                                                                    | 是   | success  | 部分论文候选缺少可核验机构信息，已跳过。                     |
| [hunyuan-hf-papers](https://huggingface.co/Tencent-Hunyuan/papers)                                                                | 是   | success  | 部分论文候选缺少可核验机构信息，已跳过。                     |
| [baidu-hf-papers](https://huggingface.co/baidu/papers)                                                                            | 是   | success  | 2 条候选未通过严格作者机构复核，已隐藏；仅发布证据完整条目。 |
| [longcat-hf-papers](https://huggingface.co/meituan-longcat/papers)                                                                | 是   | success  | 3 条候选未通过严格作者机构复核，已隐藏；仅发布证据完整条目。 |
| [ant-hf-papers](https://huggingface.co/antgroup/papers)                                                                           | 是   | success  | 1 条候选未通过严格作者机构复核，已隐藏；仅发布证据完整条目。 |
| [seed-official-papers](https://seed.bytedance.com/en/public_papers)                                                               | 是   | success  | 已取得可核验的论文元数据                                     |
| [noah-official-papers](https://www.noahlab.com.hk/en/research_paper)                                                              | 是   | success  | 已取得可核验的论文元数据                                     |
| [tripscore-paper-papers](https://arxiv.org/html/2510.09011v3)                                                                     | 是   | success  | 已取得可核验的论文元数据                                     |
| [aaai-joint-paper-papers](https://ojs.aaai.org/index.php/AAAI/article/view/26509)                                                 | 是   | success  | 已取得可核验的论文元数据                                     |

## 去重、日期与边界

相同 DOI 或 arXiv 编号在不同公司渠道出现时合并为一条论文，保留多家公司归属和全部来源。arXiv 的 PDF、HTML 和版本链接归一为摘要页身份。仅有相似标题，或 DOI 与 arXiv 编号之间没有明确关系时，不自动合并。

Crossref 的查询结果有分页与相关度范围，每个来源按配置条数采集，不承诺覆盖某公司的全部历史论文。当前正式出版物按每源最多 30 条初次回填，常规最多 20 条更新；机构预印本页每次最多核验 5 个候选。已有记录保留，来源失败不会清空历史。

年份或月份不完整时不补造具体发布日期。华为诺亚目录的上传日期与会议年份并不一致，因此不用目录上传时间作为论文发表日期。缺少完整发表日期时，界面按现有规则显示发现日期，并在无障碍标签中说明。

arXiv 请求遵守 robots.txt 的 15 秒 crawl-delay，已有作者机构证据可从快照复用。本轮新增 17 项针对机构误判、标题与引用误判、同名机构、日期、目录身份、跨公司去重及来源约束的单元测试。完整构建、浏览器验收和发布结果另以实际执行记录为准。

本轮对 26 篇 arXiv 作者机构证据重新抓取核验，隐藏 12 篇无法取得明确机构署名的记录；同时移除了将作者姓名 Jingdong Chen 错认成京东的归属。上述隐藏记录不进入公开 JSON、RSS 或论文面板。

发布前同步维护者最新移除 OPPO 的变更，论文渠道及其归属一并退出当前范围；上表与公开数据反映合入后的结果。

小红书栏目按维护者要求移除，相应的 30 篇独占论文及 Crossref 来源已退出当前索引，其他公司的论文记录保留。
