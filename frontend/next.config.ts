import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML in `out/`, served by the FastAPI backend.
  output: "export",
  // `/nda` is emitted as `nda/index.html`, which static servers resolve.
  trailingSlash: true,
  // Lets the e2e tests export into their own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
