const basePath = (process.env.BASE_PATH ?? "/ai-engineering-radar").replace(
  /\/$/,
  "",
);
/** @type {import('next').NextConfig} */
export default {
  output: "export",
  trailingSlash: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  poweredByHeader: false,
};
