/**
 * Remove Cloudflare Images handlers from the generated worker.
 * The app uses images: { unoptimized: true } and does not need the IMAGES binding.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".open-next",
  "worker.js"
);

if (!fs.existsSync(workerPath)) process.exit(0);

let source = fs.readFileSync(workerPath, "utf8");

if (source.includes("PATCHED_NO_IMAGES")) process.exit(0);

source = source
  .replace(
    `//@ts-expect-error: Will be resolved by wrangler build
import { handleCdnCgiImageRequest, handleImageRequest } from "./cloudflare/images.js";
`,
    ""
  )
  .replace(
    `            // Serve images in development.
            // Note: "/cdn-cgi/image/..." requests do not reach production workers.
            if (url.pathname.startsWith("/cdn-cgi/image/")) {
                return handleCdnCgiImageRequest(url, env);
            }
            // Fallback for the Next default image loader.
            if (url.pathname ===
                \`\${globalThis.__NEXT_BASE_PATH__}/_next/image\${globalThis.__TRAILING_SLASH__ ? "/" : ""}\`) {
                return await handleImageRequest(url, request.headers, env);
            }
`,
    ""
  );

source = `// PATCHED_NO_IMAGES\n${source}`;
fs.writeFileSync(workerPath, source);
console.log("patch-worker: removed Cloudflare Images handlers");
