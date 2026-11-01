const repository = "https://github.com/liuminxin45/ai-engineering-radar";

export function SourceContribution() {
  return (
    <aside className="detail-section" aria-label="贡献来源">
      <h2>让更多工程实践被找到</h2>
      <p>
        首批收录国内公司，欢迎提交 PR
        适配新来源，包括第三方博客社区中的国内官方团队账号。
        提供公司、发布主体、稳定账号 ID、官方证据和允许采集的入口， 再用 fixture
        与测试验证适配器。
      </p>
      <p className="small muted">本批暂不接入海外来源。</p>
      <p>
        <a href={`${repository}/compare`}>提交 PR 适配新来源</a>
        <span aria-hidden="true"> · </span>
        <a href={`${repository}/blob/main/CONTRIBUTING.md`}>阅读贡献指南</a>
        <span aria-hidden="true"> · </span>
        <a href={`${repository}/issues/new?template=source.yml`}>
          提供来源线索
        </a>
      </p>
    </aside>
  );
}
