import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // OpenNext runs this internally; keep it separate from `npm run build` to avoid recursion.
  buildCommand: "npm run build:next",
};
