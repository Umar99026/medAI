import fs from "node:fs";

const symlinkSync = fs.symlinkSync.bind(fs);
fs.symlinkSync = (target, path, type) => {
  try {
    symlinkSync(target, path, type);
  } catch {
    fs.cpSync(target, path, { recursive: true, force: true });
  }
};
