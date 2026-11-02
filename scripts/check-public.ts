import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
const roots = [
  "packages",
  "scripts",
  "config",
  "docs",
  "apps/web/src",
  "apps/web/out",
  ".github",
  process.env.RADAR_DATA_DIR ?? ".radar/data",
];
const forbidden = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{24,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /[A-Z]:[\\/](?:Users|Neo|Leo|UF)[\\/]/i,
  /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|[^\s/"']+\.tp-link\.com\.cn)(?::\d+)?/i,
];
let count = 0;
async function scan(dir: string) {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const file = join(dir, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", ".next", "generated"].includes(e.name))
        await scan(file);
    } else if (
      [
        ".ts",
        ".tsx",
        ".js",
        ".json",
        ".html",
        ".md",
        ".css",
        ".xml",
        ".atom",
        ".yml",
        ".yaml",
      ].includes(extname(file))
    ) {
      if (["check-public.ts", "serve.ts", "verify-live.ts"].includes(e.name))
        continue;
      const text = await readFile(file, "utf8");
      const patterns = file.split(/[\\/]/).includes("out")
        ? forbidden
        : forbidden.slice(0, 4);
      if (patterns.some((p) => p.test(text)))
        throw new Error(`Public content check failed: ${file}`);
      if (
        !process.env.RADAR_ALLOW_FIXTURES &&
        file.split(/[\\/]/).includes("out") &&
        /fixture-(?:paper-)?\d+|Synthetic data must never|AI Coding 工程实践 \d+:|Joint AI systems research \d+:/.test(
          text,
        )
      )
        throw new Error(`Fixture data leaked into output: ${file}`);
      count++;
    }
  }
}
for (const root of roots) await scan(root);
console.log(`Public content check passed: ${count} files`);
