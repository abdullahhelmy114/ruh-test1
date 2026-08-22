import sharp from "sharp";
import fs from "fs";

const images = [
  { input: "public/dark.svg", output: "public/dark.png" },
  { input: "public/light1.svg", output: "public/light1.png" },
];

for (const img of images) {
  if (!fs.existsSync(img.input)) {
    console.log(`File not found: ${img.input}`);
    continue;
  }
  await sharp(img.input, { density: 300 })
    .png({ quality: 90 })  // جودة عالية
    .toFile(img.output);
  console.log(`Converted ${img.input} -> ${img.output}`);
}