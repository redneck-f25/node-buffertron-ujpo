import path from 'node:path';
import { fileURLToPath } from "node:url";

function isMain(importUrl) {
  const importPath = fileURLToPath(importUrl);
  if (importPath === process.argv[1]) {
    return true;
  }
  if (importPath === path.join(process.argv[1], 'main.js')) {
    return true;
  }
  return false;
}

export {
  isMain
}
