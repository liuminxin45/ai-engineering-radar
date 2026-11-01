import { readFile } from "node:fs/promises";
import {
  sourceSchema,
  type Source,
  type Company,
  type Publisher,
} from "../shared/types.js";

export async function loadRegistry() {
  const raw = JSON.parse(
    await readFile(new URL("./registry.json", import.meta.url), "utf8"),
  );
  const sources: Source[] = raw.sources.map((s: unknown) =>
    sourceSchema.parse(s),
  );
  const companies: Company[] = raw.companies;
  const publishers: Publisher[] = raw.publishers;
  for (const [name, records] of Object.entries({
    companies,
    publishers,
    sources,
  })) {
    const ids = records.map((r) => r.id);
    if (new Set(ids).size !== ids.length)
      throw new Error(`Duplicate ${name} id`);
  }
  for (const p of publishers)
    if (!companies.some((c) => c.id === p.companyId))
      throw new Error(`Unknown company: ${p.companyId}`);
  for (const s of sources)
    if (!publishers.some((p) => p.id === s.publisherId))
      throw new Error(`Unknown publisher: ${s.publisherId}`);
  return { sources, companies, publishers };
}
export type Registry = Awaited<ReturnType<typeof loadRegistry>>;
