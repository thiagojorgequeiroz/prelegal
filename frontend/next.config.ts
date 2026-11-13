import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the e2e tests build into their own folder, so they can run while a
  // dev server is using `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
