import type { AcquisitionTrace } from "../../shared/acquisition.js";
import type { AcquiredDocument, DocumentProvider } from "./types.js";

// The caller supplies acceptance/parsing. A 200 or a challenge shell is not
// success until the consumer accepts the document. Transport remains swappable.
export async function acquireWithFallback<T extends object>(
  providers: DocumentProvider[],
  accept: (document: AcquiredDocument) => T | Promise<T>,
): Promise<T & { acquisition: AcquisitionTrace }> {
  const attempts: AcquisitionTrace["attempts"] = [];
  for (const provider of providers) {
    try {
      const result = await accept(await provider.fetch());
      attempts.push({ provider: provider.id, status: "success" });
      return { ...result, acquisition: { provider: provider.id, attempts } };
    } catch {
      // Provider details can include proxy credentials or response bodies.
      attempts.push({ provider: provider.id, status: "failed" });
    }
  }
  throw new Error(
    `正文获取失败：${attempts.map((a) => a.provider).join("、")} 均未取得可用正文。`,
  );
}
