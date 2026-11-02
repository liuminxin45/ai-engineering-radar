import type { Advertorial, Article } from "../shared/types.js";

export const ADVERTORIAL_VERSION = "advertorial-trial-1";
type Input = Pick<Article, "title" | "description" | "advertorial">;

// Trial signals describe the text, never a publisher's identity or product name.
const benefits =
  /(?:专属|限时|限量|新人|新客|持卡人|注册|充值|购买|订阅|领取|免费).{0,16}(?:福利|优惠|折扣|代金券|礼包|赠送|返现)|(?:福利|优惠|代金券|礼包).{0,12}(?:领取|来了|来袭|放送)/i;
const conversion =
  /立即(?:购买|注册|开通)|点击.{0,8}(?:领取|购买|注册|报名)|扫码.{0,8}(?:领取|购买|注册|报名)|限时免费|充值.{0,8}(?:赠|送|返)|首单.{0,8}(?:优惠|折扣|立减)/i;
const recruitment =
  /活动报名(?!系统|平台|接口|架构|流程|服务|功能)|免费报名|开放报名|报名(?:中|开启|进行中)|邀你报名|报名[！!｜|]|持续报名/i;
const launch =
  /产品升级|重磅升级|全新上线|重磅(?:发布|推出)|正式上线|免费公测|六大能力全解析/i;
const hype =
  /行业第一|全球领先|全面领先|遥遥领先|最强大脑|重新定义.{0,12}(?:标准|未来)|赋能|引领|更高效|更智能|更统一|一站式|六大能力|四大能力/i;

// Generic words such as 架构、实践、性能 alone do not establish useful detail.
const technicalDetails = [
  /(?:采用|通过|基于|使用).{0,55}(?:PPO|SFT|RLHF|DPO|KV.?Cache|Raft|WAL|HNSW|B.?tree|SQL|SSO|OAuth|缓存|分片|索引|队列|批处理|并行|量化|梯度|注意力|调度算法)/i,
  /(?:p99|p95|QPS|TPS|吞吐|延迟|时延|显存|内存|耗时|成功率).{0,35}\d+(?:\.\d+)?\s*(?:%|ms|毫秒|秒|GB|MB|倍|s\b)/i,
  /(?:从|由)\s*\d+(?:\.\d+)?\s*(?:ms|秒|GB|MB|%|小时).{0,18}(?:降|缩|增|提|到|至).{0,12}\d+/i,
  /(?:故障|根因|踩坑|权衡|取舍|局限|不适用|适用条件|测试环境|测试条件|对照实验|复现步骤|配置示例|代码示例|伪代码)/i,
  /(?:拆分|合并|解耦|隔离|路由|重试|回退|回滚|加锁|分片|索引).{0,40}(?:因为|避免|解决|导致|代价|开销|瓶颈|一致性)/i,
];

function evidence(input: Input, pattern: RegExp): Advertorial["evidence"] {
  for (const field of ["title", "description"] as const) {
    const value = input[field] ?? "";
    const match = pattern.exec(value);
    if (match) {
      const start = Math.max(0, match.index - 24);
      return [{ field, text: value.slice(start, start + 160) }];
    }
  }
  return [];
}

export function assessAdvertorial(input: Input): Advertorial {
  if (input.advertorial?.method === "manual") return input.advertorial;
  const combined = `${input.title}\n${input.description ?? ""}`;
  const detailCount = technicalDetails.filter((rule) =>
    rule.test(combined),
  ).length;
  const findings: Array<{ reason: string; evidence: Advertorial["evidence"] }> =
    [];
  // A promotional title is an explicit intent signal, even without an excerpt.
  if (benefits.test(input.title))
    findings.push({
      reason: "标题以福利、优惠或权益促销为主",
      evidence: evidence(input, benefits),
    });
  if (recruitment.test(input.title))
    findings.push({
      reason: "标题以活动报名或招募为主",
      evidence: evidence(input, recruitment),
    });
  if (conversion.test(input.title))
    findings.push({
      reason: "标题包含购买、注册或限时优惠引流",
      evidence: evidence(input, conversion),
    });
  // An isolated footer CTA, a product release, or a superlative is insufficient.
  if (!findings.length && detailCount === 0 && input.description) {
    if (
      conversion.test(combined) &&
      (benefits.test(combined) || hype.test(combined))
    )
      findings.push({
        reason: "标题摘要同时出现引流与宣传信号，未见具体工程细节",
        evidence: [
          ...evidence(input, conversion),
          ...evidence(input, benefits.test(combined) ? benefits : hype),
        ],
      });
    else if (launch.test(input.title) && hype.test(combined))
      findings.push({
        reason: "产品升级宣传与效果口号集中出现，标题摘要未见具体工程细节",
        evidence: [...evidence(input, launch), ...evidence(input, hype)],
      });
  }
  const snippets = findings
    .flatMap((f) => f.evidence)
    .filter(
      (v, i, all) =>
        all.findIndex((x) => x.field === v.field && x.text === v.text) === i,
    )
    .slice(0, 6);
  return {
    status: findings.length
      ? "suspected"
      : input.description
        ? "unmarked"
        : "insufficient",
    method: "rules",
    basis: "title-description",
    reason: findings.length
      ? `${findings.map((f) => f.reason).join("；")}。仅依据标题和短摘要提示疑似软文，待人工复核；未判断全文质量。`
      : input.description
        ? "标题摘要未命中试运行标记规则；不代表全文已经审查。"
        : "缺少短摘要且标题没有明确营销信号，暂不标记；待补充材料复核。",
    evidence: snippets,
    version: ADVERTORIAL_VERSION,
  };
}

export function markAdvertorials(articles: Article[]) {
  for (const article of articles)
    article.advertorial = assessAdvertorial(article);
}
