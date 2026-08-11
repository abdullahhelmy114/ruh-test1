// src/components/library/bookTexture.ts
import * as THREE from "three";

const GOLD = "#C49A3C";

function isLight(hex: string) {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.62;
}

function baseCanvas(w: number, h: number, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(color);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `#${c.clone().multiplyScalar(1.14).getHexString()}`);
  grad.addColorStop(0.45, `#${c.getHexString()}`);
  grad.addColorStop(1, `#${c.clone().multiplyScalar(0.68).getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // woven cloth weave
  ctx.globalAlpha = 0.045;
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 3) {
    ctx.strokeStyle = x % 6 ? "#000000" : "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 3) {
    ctx.strokeStyle = y % 6 ? "#000000" : "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // leather speckle
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = i % 2 ? "#000000" : "#ffffff";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3);
  }

  // soft vignette + edge wear
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, h * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

function finish(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Vertical spine artwork: title running along the spine with gilded bands. */
export function makeSpineTexture(title: string, color: string) {
  const w = 256;
  const h = 1024;
  const { canvas, ctx } = baseCanvas(w, h, color);
  const ink = isLight(color) ? "#3A2B21" : "#F1E4C6";

  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  [70, 96, h - 96, h - 70].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(26, y);
    ctx.lineTo(w - 26, y);
    ctx.stroke();
  });
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 62;
  ctx.font = `600 ${size}px Georgia, serif`;
  while (ctx.measureText(title).width > h - 280 && size > 24) {
    size -= 2;
    ctx.font = `600 ${size}px Georgia, serif`;
  }
  ctx.fillText(title, 0, 0);
  ctx.restore();

  ctx.fillStyle = GOLD;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(w / 2, h - 150, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // rounded-spine shading
  const round = ctx.createLinearGradient(0, 0, w, 0);
  round.addColorStop(0, "rgba(0,0,0,0.42)");
  round.addColorStop(0.18, "rgba(0,0,0,0.12)");
  round.addColorStop(0.42, "rgba(255,255,255,0.14)");
  round.addColorStop(0.6, "rgba(255,255,255,0.05)");
  round.addColorStop(0.86, "rgba(0,0,0,0.16)");
  round.addColorStop(1, "rgba(0,0,0,0.46)");
  ctx.fillStyle = round;
  ctx.fillRect(0, 0, w, h);

  // raised hubs
  ctx.globalAlpha = 0.22;
  [h * 0.3, h * 0.52, h * 0.74].forEach((y) => {
    const band = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    band.addColorStop(0, "rgba(0,0,0,0.6)");
    band.addColorStop(0.5, "rgba(255,255,255,0.55)");
    band.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 12, w, 24);
  });
  ctx.globalAlpha = 1;

  return finish(canvas);
}

/** Front cover artwork: framed panel, title, author and a gilded medallion. */
export function makeCoverTexture(title: string, author: string, color: string) {
  const w = 640;
  const h = 900;
  const { canvas, ctx } = baseCanvas(w, h, color);
  const ink = isLight(color) ? "#2B2015" : "#F5EAD2";

  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 6;
  ctx.strokeRect(46, 46, w - 92, h - 92);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, w - 128, h - 128);
  ctx.globalAlpha = 1;

  // medallion
  ctx.save();
  ctx.translate(w / 2, h * 0.36);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 96, 42, (i * Math.PI) / 8, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  ctx.font = "600 48px Georgia, serif";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > w - 200 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, w / 2, h * 0.62 + i * 58));

  ctx.font = "300 26px Georgia, serif";
  ctx.globalAlpha = 0.8;
  ctx.fillText(author.toUpperCase(), w / 2, h * 0.82);
  ctx.globalAlpha = 1;

  // hinge shadow + sheen
  const hinge = ctx.createLinearGradient(0, 0, w * 0.14, 0);
  hinge.addColorStop(0, "rgba(0,0,0,0.42)");
  hinge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hinge;
  ctx.fillRect(0, 0, w * 0.14, h);
  const sheen = ctx.createLinearGradient(0, h, w, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0.07)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  return finish(canvas);
}

export function makePageTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 256, 0);
  base.addColorStop(0, "#F3E9D2");
  base.addColorStop(0.5, "#EADDBF");
  base.addColorStop(1, "#DCCBA6");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#C3AF88";
  ctx.lineWidth = 1;
  for (let x = 0; x < 256; x += 2) {
    ctx.globalAlpha = 0.18 + Math.random() * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(canvas);
}