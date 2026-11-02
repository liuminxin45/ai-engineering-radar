import type { Article } from "../shared/types.js";

export const CONTENT_SIGNALS_VERSION = "content-signals-trial-1";
export const contentSignalLabels = {
  activity: "活动／福利",
  tutorial: "疑似教程",
  research: "疑似研究",
  "ai-technical": "疑似 AI 技术",
  review: "待判断",
} as const;
export type ContentSignalKind = keyof typeof contentSignalLabels;

// Forms and topic relevance are separate hints, never admission decisions.
const activity =
  /活动报名(?!系统|平台|接口|架构|流程|服务|功能)|(?:沙龙|大会|峰会).{0,8}报名|(?:免费|开放|邀你)报名|议题征集|征集议题|CFP\s*(?:开放|征集)|红包封面.{0,12}(?:来抢|领取|抽奖)|(?:参与|福利)抽奖/i;
const tutorial =
  /如何(?:使用|配置|安装|接入)|(?:使用|安装|接入)教程|配置.{0,20}免登录|IAM配置|完整实操/i;
const research =
  /(?:CVPR|ICML|NeurIPS|ICLR|AAAI|ACL|KDD|VLDB)\s*['’]?\s*\d{2,4}|评测基准|训练方法|(?:发布|构建|提出).{0,16}数据集|论文(?:解析|精选|解读)/i;
const ai =
  /\bAI\b|\bLLM\b|\bRAG\b|agent|大模型|人工智能|智能体|推荐模型|生成式推荐|视频生成|图像编辑|向量检索/i;
const mechanism =
  /缓存|调度|量化|上下文|权限|隔离|评测|故障|恢复|推理|训练|编译|检索|部署|架构|验证|算子|修复|性能|Harness|MCP|Skill|Text.to.SQL/i;

type Input = Pick<Article, "title" | "description">;
export function assessContentSignals(input: Input) {
  const evidence: Array<{ field: "title" | "description"; text: string }> = [];
  function find(pattern: RegExp, titleOnly = false) {
    for (const field of titleOnly
      ? (["title"] as const)
      : (["title", "description"] as const)) {
      const value = input[field] ?? "";
      const match = pattern.exec(value);
      if (match) {
        const start = Math.max(0, match.index - 24);
        const text = value.slice(start, start + 160);
        if (!evidence.some((e) => e.field === field && e.text === text))
          evidence.push({ field, text });
        return true;
      }
    }
    return false;
  }
  const kinds: ContentSignalKind[] = [];
  if (find(activity, true)) kinds.push("activity");
  if (find(tutorial, true)) kinds.push("tutorial");
  if (find(research)) kinds.push("research");
  const hasAI = find(ai),
    hasMechanism = find(mechanism);
  if (hasAI && hasMechanism) kinds.push("ai-technical");
  if (!kinds.length) kinds.push("review");
  return {
    version: CONTENT_SIGNALS_VERSION,
    method: "rules" as const,
    basis: "title-description" as const,
    kinds,
    label: contentSignalLabels[kinds[0]],
    evidence: evidence.slice(0, 6),
    reason:
      kinds[0] === "review"
        ? "标题摘要信号不足，保留待判断；未命中不代表不相关。"
        : "按标题摘要中的文章形式或 AI 对象与技术机制组合提示；未审核全文，不代表真实工程实践已获验证。",
  };
}
