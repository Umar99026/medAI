import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

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
};

export default nextConfig;

initOpenNextCloudflareForDev();
