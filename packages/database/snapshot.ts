import {
  readFile,
  mkdir,
  writeFile,
  rename,
  rm,
  readdir,
  stat,
  open,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  articleSchema,
  articleCompanyIds,
  manifestSchema,
  sourceStateSchema,
  type Snapshot,
  type Article,
  type SourceState,
} from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import { articleBodySchema, type ArticleBody } from "../shared/article-body.js";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function withSnapshotLock<T>(
  dir: string,
  run: () => Promise<T>,
): Promise<T> {
  await mkdir(dirname(resolve(dir)), { recursive: true });
  const path = resolve(dir) + ".lock";
  const handle = await open(path, "wx").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        "Snapshot is locked by another command. Inspect the lock owner before removing a stale lock.",
      );
    throw error;
  });
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return await run();
  } finally {
    await handle.close();
    await rm(path);
  }
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
export function validateRelations(
  articles: Article[],
  states: SourceState[],
  registry: Registry,
  bodies: ArticleBody[] = [],
) {
  const sourceMap = new Map(registry.sources.map((s) => [s.id, s]));
  const articleIds = new Set<string>();
  const locationKeys = new Set<string>();
  for (const a of articles) {
    articleSchema.parse(a);
    if (articleIds.has(a.id)) throw new Error(`Duplicate article ${a.id}`);
    articleIds.add(a.id);
    const p = registry.publishers.find((p) => p.id === a.publisherId);
    if (!p || p.companyId !== a.companyId)
      throw new Error(`Invalid publisher relation ${a.id}`);
    for (const id of articleCompanyIds(a))
      if (!registry.companies.some((c) => c.id === id))
        throw new Error(`Unknown company affiliation ${id}: ${a.id}`);
    for (const l of a.locations) {
      const s = sourceMap.get(l.sourceId);
      const owner =
        s && registry.publishers.find((p) => p.id === s.publisherId)?.companyId;
      if (
        !s ||
        (s.publisherId !== a.publisherId &&
          !(
            a.contentType === "paper" &&
            owner &&
            a.companyIds?.includes(owner) &&
            a.paperAffiliations?.some((p) => p.companyId === owner)
          ))
      )
        throw new Error(`Invalid source relation ${a.id}`);
      if (l.externalId) {
        const key = `${l.sourceId}:${l.externalId}`;
        if (locationKeys.has(key))
          throw new Error(`Duplicate source identifier ${key}`);
        locationKeys.add(key);
      }
    }
  }
  const stateIds = new Set<string>();
  for (const state of states) {
    sourceStateSchema.parse(state);
    if (!sourceMap.has(state.sourceId) || stateIds.has(state.sourceId))
      throw new Error("Invalid source state");
    stateIds.add(state.sourceId);
  }
  const bodyIds = new Set<string>();
  for (const raw of bodies) {
    const body = articleBodySchema.parse(raw);
    const article = articles.find((a) => a.id === body.articleId);
    if (
      !article ||
      article.contentType === "paper" ||
      bodyIds.has(body.articleId)
    )
      throw new Error(`Invalid body article relation ${body.articleId}`);
    if (
      !article.locations.some((location) => location.sourceId === body.sourceId)
    )
      throw new Error(`Invalid body source relation ${body.articleId}`);
    const source = sourceMap.get(body.sourceId)!;
    const hosts = [
      new URL(source.url).hostname,
      new URL(source.entryUrl).hostname,
      ...(source.linkHosts ?? []),
      ...(source.bodyHosts ?? []),
    ];
    if (!hosts.includes(new URL(body.sourceUrl).hostname))
      throw new Error(`Invalid body URL relation ${body.articleId}`);
    if (body.html && digest(body.html) !== body.contentHash)
      throw new Error(`Body checksum mismatch: ${body.articleId}`);
    bodyIds.add(body.articleId);
  }
}
export async function readSnapshot(dir: string): Promise<Snapshot> {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")),
  );
  const articles: Article[] = [];
  const states: SourceState[] = [];
  const bodies: ArticleBody[] = [];
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (
      !/^(articles|sources)\/[a-z0-9-]+\.json$/.test(file) &&
      !(
        manifest.schemaVersion === 2 &&
        /^bodies\/[a-f0-9]{20}\.json$/.test(file)
      )
    )
      throw new Error(`Invalid snapshot filename ${file}`);
    const raw = await readFile(join(dir, file), "utf8");
    if (digest(raw) !== hash)
      throw new Error(`Snapshot checksum mismatch: ${file}`);
    const data = JSON.parse(raw);
    if (data.schemaVersion !== 1) throw new Error("Unsupported data schema");
    if (file.startsWith("articles/"))
      articles.push(
        ...data.articles.map((a: unknown) => articleSchema.parse(a)),
      );
    else if (file.startsWith("bodies/")) {
      const body = articleBodySchema.parse(data.body);
      if (
        file !== `bodies/${body.articleId}.json` ||
        (body.html && digest(body.html) !== body.contentHash)
      )
        throw new Error(`Invalid body checksum or filename: ${file}`);
      bodies.push(body);
    } else states.push(sourceStateSchema.parse(data.state));
  }
  if (
    articles.length !== manifest.articleCount ||
    states.length !== manifest.sourceCount ||
    (manifest.schemaVersion === 2 && bodies.length !== manifest.bodyCount)
  )
    throw new Error("Snapshot counts do not match");
  return { manifest, articles, states, bodies };
}
export async function loadSnapshot(
  dir: string,
  registry: Registry,
): Promise<Snapshot> {
  const snapshot = await readSnapshot(dir);
  validateRelations(
    snapshot.articles,
    snapshot.states,
    registry,
    snapshot.bodies,
  );
  return snapshot;
}
export async function saveSnapshot(
  dir: string,
  articles: Article[],
  states: SourceState[],
  registry: Registry,
  bodies?: ArticleBody[],
) {
  if (bodies === undefined) {
    const previous = (await snapshotExists(dir))
      ? await readSnapshot(dir)
      : undefined;
    bodies = (previous?.bodies ?? []).filter((body) =>
      articles.some(
        (article) =>
          article.id === body.articleId &&
          article.contentType !== "paper" &&
          article.locations.some(
            (location) => location.sourceId === body.sourceId,
          ),
      ),
    );
  }
  validateRelations(articles, states, registry, bodies);
  const target = resolve(dir);
  await mkdir(dirname(target), { recursive: true });
  const stage = `${target}.stage-${randomUUID()}`;
  await mkdir(join(stage, "articles"), { recursive: true });
  await mkdir(join(stage, "sources"));
  await mkdir(join(stage, "bodies"));
  const files: Record<string, string> = {};
  async function put(file: string, data: unknown) {
    const raw = json(data);
    await writeFile(join(stage, file), raw);
    files[file] = digest(raw);
  }
  for (const p of registry.publishers) {
    const items = articles
      .filter((a) => a.publisherId === p.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (items.length)
      await put(`articles/${p.id}.json`, { schemaVersion: 1, articles: items });
  }
  for (const state of [...states].sort((a, b) =>
    a.sourceId.localeCompare(b.sourceId),
  ))
    await put(`sources/${state.sourceId}.json`, { schemaVersion: 1, state });
  for (const body of [...bodies].sort((a, b) =>
    a.articleId.localeCompare(b.articleId),
  ))
    await put(`bodies/${body.articleId}.json`, { schemaVersion: 1, body });
  await writeFile(
    join(stage, "manifest.json"),
    json({
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      articleCount: articles.length,
      sourceCount: states.length,
      bodyCount: bodies.length,
      files,
    }),
  );
  await loadSnapshot(stage, registry);
  // Keep the previous directory until the replacement has been validated and renamed.
  const backup = `${target}.previous-${randomUUID()}`;
  let existed = false;
  try {
    await stat(target);
    existed = true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (existed) await rename(target, backup);
  try {
    await rename(stage, target);
  } catch (error) {
    if (existed) await rename(backup, target);
    throw error;
  }
  if (existed) await rm(backup, { recursive: true });
}
export async function snapshotExists(dir: string) {
  try {
    await readFile(join(dir, "manifest.json"));
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
