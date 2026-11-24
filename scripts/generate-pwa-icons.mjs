import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public/nexo-icon.svg");
const output = path.join(root, "public/icons");
const svg = await fs.readFile(source);

await fs.mkdir(output, { recursive: true });

const outputs = [
  ["icon-192.png", 192, 192],
  ["icon-512.png", 512, 512],
  ["icon-maskable-192.png", 192, 192],
  ["icon-maskable-512.png", 512, 512],
  ["apple-touch-icon.png", 180, 180],
  ["favicon-32.png", 32, 32],
  ["favicon-16.png", 16, 16],
  ["apple-splash-1179x2556.png", 1179, 2556],
  ["apple-splash-1290x2796.png", 1290, 2796],
  ["apple-splash-1242x2208.png", 1242, 2208]
];

for (const [name, width, height] of outputs) {
  const isMaskable = name.includes("maskable");
  const isSplash = name.startsWith("apple-splash");
  const size = isSplash ? 512 : Math.min(width, height);
  const mark = await sharp(svg).resize(size, size, { fit: "contain" }).png().toBuffer();

  if (isSplash) {
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 16, g: 16, b: 18, alpha: 1 }
      }
    })
      .composite([{ input: mark, gravity: "centre" }])
      .png()
      .toFile(path.join(output, name));
    continue;
  }

  if (isMaskable) {
    const inset = Math.round(width * 0.12);
    const safeMark = await sharp(svg)
      .resize(width - inset * 2, height - inset * 2, { fit: "contain" })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 16, g: 16, b: 18, alpha: 1 }
      }
    })
      .composite([{ input: safeMark, gravity: "centre" }])
      .png()
      .toFile(path.join(output, name));
    continue;
  }

  await sharp(mark).resize(width, height).png().toFile(path.join(output, name));
}

console.log("Ícones e telas de abertura PWA gerados em public/icons/.");
