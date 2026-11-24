import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("Dependência ausente. Execute: npm install --save-dev sharp");
  process.exit(1);
}

const root = process.cwd();
const output = path.join(root, "public", "icons");
await mkdir(output, { recursive: true });

const jobs = [
  ["nexo-icon-source.svg", "nexo-192.png", 192],
  ["nexo-icon-source.svg", "nexo-512.png", 512],
  ["nexo-maskable-source.svg", "nexo-maskable-192.png", 192],
  ["nexo-maskable-source.svg", "nexo-maskable-512.png", 512],
  ["nexo-icon-source.svg", "apple-touch-icon.png", 180],
  ["nexo-icon-source.svg", "favicon-32.png", 32],
];

for (const [source, target, size] of jobs) {
  await sharp(path.join(output, source)).resize(size, size, { fit: "contain" }).png().toFile(path.join(output, target));
  console.log("Gerado:", path.relative(root, path.join(output, target)));
}
