// Build-time only. Never import this module into a client component or site.json.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { articleBodySchema } from "../../../packages/shared/article-body";

export async function loadArticleBody(id: string) {
  if (!/^[a-f0-9]{20}$/.test(id)) return;
  try {
    return articleBodySchema.parse(
      JSON.parse(
        await readFile(
          join(process.cwd(), "src/generated/bodies", `${id}.json`),
          "utf8",
        ),
      ).body,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}
