import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate build dirs so GP (3000) and specialist (3001) dev servers can run together
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
