import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = path.join(root, ".open-next", "server-functions", "default");
const chunksDir = path.join(serverRoot, ".next", "server", "chunks");

if (!fs.existsSync(chunksDir)) {
  console.log("patch-turbopack-windows: no chunks dir, skipping");
  process.exit(0);
}

const runtimePath = path.join(chunksDir, "[turbopack]_runtime.js");
if (fs.existsSync(runtimePath)) {
  const runtime = fs.readFileSync(runtimePath, "utf8");
  if (/case "server\/chunks\//.test(runtime) && !/case "C:\\\\/.test(runtime)) {
    console.log("patch-turbopack-windows: runtime already patched, skipping");
    process.exit(0);
  }
}

function collectJsChunks(dir, base = "server/chunks") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = `${base}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory()) {
      results.push(...collectJsChunks(full, rel));
    } else if (entry.name.endsWith(".js")) {
      const requirePath = `./.next/server/${rel.replace(/^server\//, "")}`;
      results.push({ chunkPath: rel, requirePath });
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

function patchRuntime(runtimePath, chunks, wasmHash, wasmImportPath) {
  if (!fs.existsSync(runtimePath)) return;

  let source = fs.readFileSync(runtimePath, "utf8");
  const prefix = root.replace(/\\/g, "/");
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  source = source.replace(new RegExp(escaped + "/.open-next/server-functions/default/", "g"), "./");
  source = source.replace(/[A-Z]:\\[^"']+\\.open-next\\server-functions\\default\\/gi, "./");

  const requireCases = chunks
    .map(({ chunkPath, requirePath }) => `      case "${chunkPath}": return require("${requirePath}");`)
    .join("\n");

  source = source.replace(
    /function requireChunk\(chunkPath\) \{[\s\S]*?\n  \}/,
    `function requireChunk(chunkPath) {
    switch(chunkPath) {
${requireCases}
      default:
        throw new Error(\`Not found \${chunkPath}\`);
    }
  }`
  );

  const wasmCases = [
    `      case "server/chunks/${wasmHash}": return (await import("${wasmImportPath}?module")).default;`,
    `      case "${path.join(chunksDir, wasmHash).replace(/\\/g, "/")}": return (await import("${wasmImportPath}?module")).default;`,
    `      case "${path.join(chunksDir, wasmHash).replace(/\\/g, "\\\\")}": return (await import("${wasmImportPath}?module")).default;`,
  ].join("\n");

  source = source.replace(
    /async function loadWasmChunk\(chunkPath\) \{[\s\S]*?\n  \}/,
    `async function loadWasmChunk(chunkPath) {
    switch (chunkPath) {
${wasmCases}
      default:
        throw new Error(\`Unknown wasm chunk: \${chunkPath}\`);
    }
  }`
  );

  fs.writeFileSync(runtimePath, source);
}

const wasmHash = findWasmHash();
const wasmSrc = path.join(root, "src", "generated", "prisma", "internal", "query_compiler_fast_bg.wasm");
const wasmDest = path.join(chunksDir, wasmHash);
const wasmSsrDir = path.join(chunksDir, "ssr");

if (fs.existsSync(wasmSrc)) {
  fs.copyFileSync(wasmSrc, wasmDest);
  if (fs.existsSync(wasmSsrDir)) {
    fs.copyFileSync(wasmSrc, path.join(wasmSsrDir, wasmHash));
  }
}

const chunks = collectJsChunks(chunksDir);
const wasmImportPath = `./.next/server/chunks/${wasmHash}`;

for (const rel of ["[turbopack]_runtime.js", "ssr/[turbopack]_runtime.js"]) {
  patchRuntime(path.join(chunksDir, rel), chunks, wasmHash, wasmImportPath);
}

const handlerPath = path.join(serverRoot, "handler.mjs");
if (fs.existsSync(handlerPath)) {
  let handler = fs.readFileSync(handlerPath, "utf8");
  const prefix = root.replace(/\\/g, "/");
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  handler = handler.replace(new RegExp(escaped + "/.open-next/server-functions/default/", "g"), "./");
  handler = handler.replace(/[A-Z]:\\[^"']+\\.open-next\\server-functions\\default\\/gi, "./");
  fs.writeFileSync(handlerPath, handler);
}

console.log(`patch-turbopack-windows: patched ${chunks.length} chunks + wasm ${wasmHash}`);
