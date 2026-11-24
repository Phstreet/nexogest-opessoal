import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("Dependência ausente. Execute: npm install");
  process.exit(1);
}

const root = process.cwd();
const output = path.join(root, "public", "icons");
await mkdir(output, { recursive: true });

const iconSource = path.join(output, "nexo-icon-source.svg");
const maskableSource = path.join(output, "nexo-maskable-source.svg");

const iconJobs = [
  [iconSource, "nexo-192.png", 192],
  [iconSource, "nexo-512.png", 512],
  [maskableSource, "nexo-maskable-192.png", 192],
  [maskableSource, "nexo-maskable-512.png", 512],
  [iconSource, "apple-touch-icon.png", 180],
  [iconSource, "favicon-32.png", 32],
];

for (const [source, target, size] of iconJobs) {
  await sharp(source).resize(size, size, { fit: "contain" }).png().toFile(path.join(output, target));
  console.log("Gerado:", path.relative(root, path.join(output, target)));
}

const splashSizes = [
  [1170, 2532],
  [1179, 2556],
  [1206, 2622],
  [1242, 2688],
  [1290, 2796],
  [2048, 2732],
];

for (const [width, height] of splashSizes) {
  const iconSize = Math.round(Math.min(width, height) * 0.19);
  const icon = await sharp(iconSource).resize(iconSize, iconSize, { fit: "contain" }).png().toBuffer();
  const wordmarkSvg = Buffer.from(
    `<svg width="${width}" height="100" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="62" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="12" fill="#DDE2E9">NEXO</text></svg>`
  );
  const wordmark = await sharp(wordmarkSvg).png().toBuffer();
  const left = Math.round((width - iconSize) / 2);
  const top = Math.round(height * 0.36 - iconSize / 2);
  const wordmarkTop = Math.min(height - 130, top + iconSize + 38);
  const target = `apple-splash-${width}x${height}.png`;

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 16, g: 16, b: 18, alpha: 1 },
    },
  })
    .composite([
      { input: icon, left, top },
      { input: wordmark, left: 0, top: wordmarkTop },
    ])
    .png()
    .toFile(path.join(output, target));

  console.log("Gerado:", path.relative(root, path.join(output, target)));
}
