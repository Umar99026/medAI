/**
 * Windows workaround: OpenNext uses symlinks which fail without Developer Mode.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const patch = pathToFileURL(path.join(__dirname, "symlink-patch.mjs")).href;

function run(args) {
  const result = spawnSync("npx", args, {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      NODE_OPTIONS: `--import ${patch}`,
    },
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run(["opennextjs-cloudflare", "build"]);
run(["opennextjs-cloudflare", "deploy"]);
