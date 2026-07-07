import type { NextConfig } from "next";
import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const prismaBrowserAlias = path.join(
  process.cwd(),
  "src/generated/prisma/browser.ts"
);

const nextConfig: NextConfig = {
  // Separate build dirs so GP (3000) and specialist (3001) dev servers can run together
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
  ],
  images: { unoptimized: true },
  // Next 16 uses Turbopack by default; empty config allows a webpack override for dev.
  turbopack: {},
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.module.rules.push({
      test: /\.wasm$/i,
      type: "webassembly/async",
    });
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/generated/prisma/client": prismaBrowserAlias,
      };
    }
    return config;
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
