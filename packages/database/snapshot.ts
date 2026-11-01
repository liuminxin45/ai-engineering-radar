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
  manifestSchema,
  sourceStateSchema,
  type Snapshot,
  type Article,
  type SourceState,
} from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
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
    for (const l of a.locations) {
      const s = sourceMap.get(l.sourceId);
      if (!s || s.publisherId !== a.publisherId)
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
}
export async function loadSnapshot(
  dir: string,
  registry: Registry,
): Promise<Snapshot> {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")),
  );
  const articles: Article[] = [];
  const states: SourceState[] = [];
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (!/^(articles|sources)\/[a-z0-9-]+\.json$/.test(file))
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
    else states.push(sourceStateSchema.parse(data.state));
  }
  if (
    articles.length !== manifest.articleCount ||
    states.length !== manifest.sourceCount
  )
    throw new Error("Snapshot counts do not match");
  validateRelations(articles, states, registry);
  return { manifest, articles, states };
}
export async function saveSnapshot(
  dir: string,
  articles: Article[],
  states: SourceState[],
  registry: Registry,
) {
  validateRelations(articles, states, registry);
  const target = resolve(dir);
  await mkdir(dirname(target), { recursive: true });
  const stage = `${target}.stage-${randomUUID()}`;
  await mkdir(join(stage, "articles"), { recursive: true });
  await mkdir(join(stage, "sources"));
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
  await writeFile(
    join(stage, "manifest.json"),
    json({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      articleCount: articles.length,
      sourceCount: states.length,
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
