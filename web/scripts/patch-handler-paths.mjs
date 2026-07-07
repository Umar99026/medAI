import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const handlerPath = path.join(root, ".open-next", "server-functions", "default", "handler.mjs");

if (!fs.existsSync(handlerPath)) process.exit(0);

let source = fs.readFileSync(handlerPath, "utf8");
const prefix = root.replace(/\\/g, "/");
const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fix absolute Windows dynamic imports that break wrangler's module collector.
source = source.replace(new RegExp(escaped + "/.open-next/server-functions/default/", "g"), "./");

// Fix Prisma WASM imports that use mangled chunk names on Windows.
const wasmRel = "./.next/server/chunks/src_generated_prisma_internal_query_compiler_fast_bg_0athij3.wasm";
source = source.replace(
  /\.\/\.next\/server\/chunks\/(?:ssr\/)?[a-z0-9._-]*query_compiler_fast_bg_[a-z0-9]+\.wasm/gi,
  wasmRel
);
source = source.replace(
  /"C:\/[^"]*query_compiler_fast_bg_[^"]+\.wasm"/gi,
  `"${wasmRel}"`
);

fs.writeFileSync(handlerPath, source);
console.log("patch-handler-paths: fixed handler import paths");
