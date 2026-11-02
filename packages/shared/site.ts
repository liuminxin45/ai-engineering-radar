export const DEFAULT_BASE_PATH = "/ai-engineering-radar";

export function resolveSiteUrl(
  env: { SITE_URL?: string; BASE_PATH?: string } = {
    SITE_URL: process.env.SITE_URL,
    BASE_PATH: process.env.BASE_PATH,
  },
) {
  const site = new URL(env.SITE_URL || "https://liuminxin45.github.io");
  if (
    !["http:", "https:"].includes(site.protocol) ||
    site.username ||
    site.password ||
    site.search ||
    site.hash ||
    site.pathname !== "/" ||
    /^(localhost|127\.[\d.]+|\[::1\])$/i.test(site.hostname)
  )
    throw new Error("SITE_URL must be a public HTTP(S) origin without a path");
  const base = (env.BASE_PATH ?? DEFAULT_BASE_PATH).replace(/\/+$/, "");
  if (base && (!base.startsWith("/") || /[?#\\]|\/\//.test(base)))
    throw new Error(
      "BASE_PATH must be an absolute path without a query or fragment",
    );
  return `${site.origin}${base}`;
}
