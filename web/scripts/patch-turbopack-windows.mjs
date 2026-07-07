import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = path.join(root, ".open-next", "server-functions", "default");
const chunksDir = path.join(serverRoot, ".next", "server", "chunks");
const handlerPath = path.join(serverRoot, "handler.mjs");

if (!fs.existsSync(chunksDir) || !fs.existsSync(handlerPath)) {
  console.log("patch-turbopack-windows: build output missing, skipping");
  process.exit(0);
}

function collectJsChunks(dir, base = "server/chunks") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = `${base}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory()) {
      results.push(...collectJsChunks(full, rel));
    } else if (entry.name.endsWith(".js")) {
      results.push({
        chunkPath: rel,
        requirePath: `./.next/server/${rel.replace(/^server\//, "")}`,
      });
    }
  }
  return results;
}

function findWasmHash() {
  for (const file of fs.readdirSync(chunksDir)) {
    if (!file.includes("query_compiler_fast_bg_wasm")) continue;
    const content = fs.readFileSync(path.join(chunksDir, file), "utf8");
    const match = content.match(/server\/chunks\/(src_generated_prisma_internal_query_compiler_fast_bg_[^.]+\.wasm)/);
    if (match) return match[1];
  }
  return "src_generated_prisma_internal_query_compiler_fast_bg_0athij3.wasm";
}

function normalizePaths(source) {
  const prefix = root.replace(/\\/g, "/");
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  source = source.replace(new RegExp(escaped + "/.open-next/server-functions/default/", "g"), "./");
  source = source.replace(/[A-Z]:\\[^"']+\\.open-next\\server-functions\\default\\/gi, "./");
  return source;
}

const wasmHash = findWasmHash();
const wasmSrc = path.join(root, "src", "generated", "prisma", "internal", "query_compiler_fast_bg.wasm");
const wasmDest = path.join(chunksDir, wasmHash);

if (fs.existsSync(wasmSrc)) {
  fs.copyFileSync(wasmSrc, wasmDest);
  const ssrWasm = path.join(chunksDir, "ssr", wasmHash);
  fs.mkdirSync(path.dirname(ssrWasm), { recursive: true });
  fs.copyFileSync(wasmSrc, ssrWasm);
}

const chunks = collectJsChunks(chunksDir);
const requireCases = chunks
  .map(({ chunkPath, requirePath }) => `case "${chunkPath}":return require("${requirePath}");`)
  .join("");

const wasmRel = `server/chunks/${wasmHash}`;
const wasmImport = `./.next/server/chunks/${wasmHash}`;

let handler = normalizePaths(fs.readFileSync(handlerPath, "utf8"));

handler = handler.replace(
  /function requireChunk\(chunkPath\)\{throw new Error\(`Not found \$\{chunkPath\}`\)\}/,
  `function requireChunk(chunkPath){switch(chunkPath){${requireCases}default:throw new Error(\`Not found \${chunkPath}\`)}}`
);

handler = handler.replace(
  /async function loadWasmChunk\(chunkPath\)\{if\(chunkPath===["'][^"']+["']\)return\(await import\(["'][^"']+["']\)\)\.default;throw new Error\(`Unknown wasm chunk: \$\{chunkPath\}`\)\}/,
  `async function loadWasmChunk(chunkPath){if(chunkPath==="${wasmRel}"||chunkPath.endsWith("${wasmHash}"))return(await import("${wasmImport}?module")).default;throw new Error(\`Unknown wasm chunk: \${chunkPath}\`)}`
);

fs.writeFileSync(handlerPath, handler);

for (const rel of ["[turbopack]_runtime.js", "ssr/[turbopack]_runtime.js"]) {
  const runtimePath = path.join(chunksDir, rel);
  if (!fs.existsSync(runtimePath)) continue;
  let runtime = fs.readFileSync(runtimePath, "utf8");
  const wasmImport = `./${wasmHash}`;
  runtime = runtime.replace(
    /async function loadWasmChunk\(chunkPath\) \{[\s\S]*?\n  \}/,
    `async function loadWasmChunk(chunkPath) {
    if (chunkPath.endsWith("${wasmHash}") || chunkPath === "server/chunks/${wasmHash}" || chunkPath === "server/chunks/ssr/${wasmHash}") {
      return (await import("${wasmImport}?module")).default;
    }
    throw new Error(\`Unknown wasm chunk: \${chunkPath}\`);
  }`
  );
  runtime = runtime.replace(/[A-Z]:\\[^"']+\.wasm/gi, `${wasmImport}?module`);
  fs.writeFileSync(runtimePath, runtime);
}

console.log(`patch-turbopack-windows: patched handler (${chunks.length} chunks, wasm ${wasmHash})`);
