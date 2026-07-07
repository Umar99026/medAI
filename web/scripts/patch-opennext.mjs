/**
 * Windows: OpenNext copyTracedFiles uses symlinks that fail without Developer Mode.
 * Patch the bundled file to fall back to recursive copy on EPERM.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "@opennextjs",
  "aws",
  "dist",
  "build",
  "copyTracedFiles.js"
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

let source = fs.readFileSync(target, "utf8");
let changed = false;

const copyFnNeedle = `export function copyFileAndMakeOwnerWritable(src, dest) {
    copyFileSync(src, dest);`;

const copyFnReplacement = `export function copyFileAndMakeOwnerWritable(src, dest) {
    try {
        copyFileSync(src, dest);
    }
    catch (e) {
        if (e.code === "EPERM" || e.code === "EISDIR" || e.code === "ENOTSUP") {
            cpSync(src, dest, { recursive: true, force: true, dereference: true });
        }
        else {
            throw e;
        }
    }`;

if (!source.includes(copyFnReplacement) && source.includes(copyFnNeedle)) {
  source = source.replace(copyFnNeedle, copyFnReplacement);
  changed = true;
}

const symlinkNeedle = `            catch (e) {
                if (e.code !== "EEXIST") {
                    throw e;
                }
            }`;

const symlinkReplacement = `            catch (e) {
                if (e.code === "EPERM" || e.code === "ENOTSUP") {
                    copyFileAndMakeOwnerWritable(from, to);
                } else if (e.code !== "EEXIST") {
                    throw e;
                }
            }`;

if (!source.includes(symlinkReplacement) && source.includes(symlinkNeedle)) {
  source = source.replace(symlinkNeedle, symlinkReplacement);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, source);
  console.log("patch-opennext: applied Windows copy fallback");
}
