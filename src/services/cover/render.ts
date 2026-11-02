import { cssGradient, type Gradient } from '../backdrops';
import { getAsset } from '../assetStore';
import { fontLoader } from '../fontLoader';
import type { CoverDesign, CoverLayer, Effects, Fill, Geometry, ImageLayer, Rect, ShapeLayer, TextLayer } from './design';

// draws a cover on a canvas. the screen and the files that are exported both come from here, so they cannot disagree.
// all sizes in the design are inches; `ppi` says how many pixels make an inch.

export type Picture = ImageBitmap | HTMLImageElement | HTMLCanvasElement;
export interface RenderOpts {
  ppi: number;
  // the part of the sheet to draw, in inches. the whole sheet when left out.
  view?: Rect;
  pictures: Map<string, Picture>;
}

const pt = (points: number, ppi: number) => (points / 72) * ppi;

export function fontString(l: TextLayer, ppi: number): string {
  return `${l.italic ? 'italic ' : ''}${l.bold ? '700 ' : '400 '}${pt(l.size, ppi)}px "${l.font.replace(/"/g, '')}", Georgia, serif`;
}

// ---- paint -------------------------------------------------------------------------------

// the line a css gradient runs along inside a box, so a gradient here looks like the one in the theme maker
function gradientLine(g: Gradient, w: number, h: number) {
  const a = (g.angle * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return { x0: w / 2 - dx * half, y0: h / 2 - dy * half, x1: w / 2 + dx * half, y1: h / 2 + dy * half };
}

export function paint(ctx: CanvasRenderingContext2D, fill: Fill, w: number, h: number): string | CanvasGradient {
  if (fill.kind === 'solid') return fill.color;
  const g = fill.gradient;
  let grad: CanvasGradient;
  if (g.kind === 'radial') {
    grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  } else {
    const l = gradientLine(g, w, h);
    grad = ctx.createLinearGradient(l.x0, l.y0, l.x1, l.y1);
  }
  g.stops.forEach(s => grad.addColorStop(Math.max(0, Math.min(1, s.at / 100)), s.color));
  return grad;
}

export const fillCss = (fill: Fill): string => (fill.kind === 'solid' ? fill.color : cssGradient(fill.gradient));

// ---- text --------------------------------------------------------------------------------

// lines are always broken as if the cover were drawn at this size, so the screen, the png and the pdf wrap alike
const REF_PPI = 300;

export interface TextLayout { lines: string[]; lineH: number; height: number } // lineH and height in inches

export function layoutText(ctx: CanvasRenderingContext2D, l: TextLayer): TextLayout {
  ctx.save();
  ctx.font = fontString(l, REF_PPI);
  setSpacing(ctx, l, REF_PPI);
  const maxW = Math.max(1, l.w * REF_PPI);
  const raw = l.upper ? l.text.toUpperCase() : l.text;
  const lines: string[] = [];
  for (const para of raw.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  ctx.restore();
  const lineH = (l.size / 72) * l.lineHeight;
  return { lines, lineH, height: lines.length * lineH };
}

function setSpacing(ctx: CanvasRenderingContext2D, l: TextLayer, ppi: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${l.spacing * pt(l.size, ppi)}px`;
}

// the size of a layer on the sheet, in inches. text is as tall as its lines.
export function layerBox(ctx: CanvasRenderingContext2D, l: CoverLayer): { w: number; h: number } {
  if (l.kind !== 'text') return { w: l.w, h: l.h };
  return { w: l.w, h: Math.max(l.size / 72, layoutText(ctx, l).height) };
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer, ppi: number, boxW: number) {
  const lay = layoutText(ctx, l);
  const lineH = lay.lineH * ppi;
  const textH = lay.height * ppi;
  const fx = l.effects;
  ctx.font = fontString(l, ppi);
  setSpacing(ctx, l, ppi);
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const w = boxW;
  const startX = (line: string) => {
    const lw = ctx.measureText(line).width;
    return l.align === 'left' ? 0 : l.align === 'right' ? w - lw : (w - lw) / 2;
  };
  const each = (fn: (line: string, x: number, y: number) => void, dx = 0, dy = 0) => lay.lines.forEach((line, i) => fn(line, startX(line) + dx, i * lineH + dy));
  const fillStyle = paint(ctx, l.fill, w, textH);
  const base = ctx.globalAlpha;

  const shadowOn = (s: { x: number; y: number; blur: number; color: string; opacity: number }) => {
    ctx.shadowColor = withAlpha(s.color, s.opacity);
    ctx.shadowOffsetX = s.x * ppi;
    ctx.shadowOffsetY = s.y * ppi;
    ctx.shadowBlur = s.blur * ppi;
  };
  const shadowOff = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

  // the glow, then the drop shadow, sit under everything else
  if (fx.glow) {
    shadowOn({ x: 0, y: 0, blur: fx.glow.blur, color: fx.glow.color, opacity: 1 });
    ctx.fillStyle = fx.glow.color;
    ctx.globalAlpha = base * Math.max(0.5, l.fillOpacity);
    each((t, x, y) => ctx.fillText(t, x, y));
    shadowOff();
  }
  if (fx.shadow) {
    shadowOn(fx.shadow);
    ctx.fillStyle = typeof fillStyle === 'string' ? fillStyle : '#000000';
    ctx.globalAlpha = base * l.fillOpacity;
    if (fx.outline) { ctx.strokeStyle = fx.outline.color; ctx.lineWidth = pt(fx.outline.width, ppi) * 2; each((t, x, y) => ctx.strokeText(t, x, y)); }
    each((t, x, y) => ctx.fillText(t, x, y));
    shadowOff();
  }
  if (fx.outline) {
    // a stroke is centered on the letter's edge, and the fill covers the inner half
    ctx.globalAlpha = base;
    ctx.strokeStyle = fx.outline.color;
    ctx.lineWidth = pt(fx.outline.width, ppi) * 2;
    each((t, x, y) => ctx.strokeText(t, x, y));
  }
  if (fx.bevel) {
    const d = Math.max(1, pt(fx.bevel.depth, ppi) * 0.5);
    ctx.globalAlpha = base * Math.max(0.6, l.fillOpacity);
    ctx.fillStyle = fx.bevel.dark;
    each((t, x, y) => ctx.fillText(t, x, y), d, d);
    ctx.fillStyle = fx.bevel.light;
    each((t, x, y) => ctx.fillText(t, x, y), -d, -d);
  }
  ctx.globalAlpha = base * l.fillOpacity;
  ctx.fillStyle = fillStyle;
  each((t, x, y) => ctx.fillText(t, x, y));
  ctx.globalAlpha = base;
}

// a color with its own see-through-ness, as css
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})` : hex;
}

// ---- shapes and pictures -----------------------------------------------------------------------

function roundedRect(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(rr, 0);
  ctx.arcTo(w, 0, w, h, rr);
  ctx.arcTo(w, h, 0, h, rr);
  ctx.arcTo(0, h, 0, 0, rr);
  ctx.arcTo(0, 0, w, 0, rr);
  ctx.closePath();
}

function applyDrop(ctx: CanvasRenderingContext2D, fx: Effects, ppi: number) {
  // pictures and shapes take the drop shadow, or the glow when there is no shadow
  if (fx.shadow) {
    ctx.shadowColor = withAlpha(fx.shadow.color, fx.shadow.opacity);
    ctx.shadowOffsetX = fx.shadow.x * ppi; ctx.shadowOffsetY = fx.shadow.y * ppi; ctx.shadowBlur = fx.shadow.blur * ppi;
  } else if (fx.glow) {
    ctx.shadowColor = fx.glow.color; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = fx.glow.blur * ppi;
  }
}

function drawShape(ctx: CanvasRenderingContext2D, l: ShapeLayer, ppi: number, w: number, h: number) {
  const base = ctx.globalAlpha;
  ctx.save();
  applyDrop(ctx, l.effects, ppi);
  ctx.beginPath();
  if (l.shape === 'ellipse') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (l.shape === 'line') { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
  else roundedRect(ctx, w, h, l.radius * ppi);
  if (l.shape !== 'line') {
    ctx.globalAlpha = base * l.fillOpacity;
    ctx.fillStyle = paint(ctx, l.fill, w, h);
    ctx.fill();
  }
  ctx.restore();
  const stroke = l.stroke ?? (l.shape === 'line' ? { width: 2, color: l.fill.kind === 'solid' ? l.fill.color : '#ffffff' } : undefined);
  if (stroke) {
    ctx.save();
    applyDrop(ctx, l.shape === 'line' ? l.effects : {}, ppi);
    ctx.globalAlpha = base;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = pt(stroke.width, ppi);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (l.shape === 'ellipse') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (l.shape === 'line') { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
    else roundedRect(ctx, w, h, l.radius * ppi);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPicture(ctx: CanvasRenderingContext2D, l: ImageLayer, pic: Picture | undefined, ppi: number, w: number, h: number) {
  ctx.save();
  applyDrop(ctx, l.effects, ppi);
  if (!pic) {
    // a picture that is missing shows as a plain box, so the layout still reads
    ctx.fillStyle = 'rgba(128, 128, 128, 0.35)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }
  if (l.radius > 0) { roundedRect(ctx, w, h, l.radius * ppi); ctx.clip(); }
  const sw = (pic as { width: number }).width, sh = (pic as { height: number }).height;
  let dw = w, dh = h, dx = 0, dy = 0;
  if (l.fit !== 'stretch') {
    const k = l.fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
    dw = sw * k; dh = sh * k; dx = (w - dw) / 2; dy = (h - dh) / 2;
  }
  if (l.flip) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  // the shadow belongs to the picture's outline, so it is drawn from a filled box under it when the picture is clipped
  ctx.drawImage(pic, dx, dy, dw, dh);
  ctx.restore();
}

// ---- the whole sheet ---------------------------------------------------------------------------

export function drawCover(ctx: CanvasRenderingContext2D, design: CoverDesign, g: Geometry, opts: RenderOpts) {
  const { ppi, pictures } = opts;
  const view = opts.view ?? { x: 0, y: 0, w: g.totalW, h: g.totalH };
  ctx.save();
  ctx.clearRect(0, 0, view.w * ppi, view.h * ppi);
  ctx.translate(-view.x * ppi, -view.y * ppi);
  const W = g.totalW * ppi, H = g.totalH * ppi;
  ctx.fillStyle = paint(ctx, design.background, W, H);
  ctx.fillRect(0, 0, W, H);

  for (const l of design.layers) {
    if (l.hidden) continue;
    const box = layerBox(ctx, l);
    const w = box.w * ppi, h = box.h * ppi;
    ctx.save();
    ctx.translate((l.x + box.w / 2) * ppi, (l.y + box.h / 2) * ppi);
    ctx.rotate((l.rotation * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
    ctx.globalAlpha = l.opacity;
    if (l.kind === 'text') drawText(ctx, l, ppi, w);
    else if (l.kind === 'shape') drawShape(ctx, l, ppi, w, h);
    else drawPicture(ctx, l, pictures.get(l.assetId), ppi, w, h);
    ctx.restore();
  }
  ctx.restore();
}

// ---- files ----------------------------------------------------------------------------------------

export async function loadPictures(ids: string[], into: Map<string, Picture> = new Map()): Promise<Map<string, Picture>> {
  await Promise.all(ids.filter(id => !into.has(id)).map(async id => {
    try {
      const blob = await getAsset(id);
      if (blob) into.set(id, await createImageBitmap(blob));
    } catch { /* a picture that will not open shows as a gray box */ }
  }));
  return into;
}

// make the fonts a design uses ready before it is drawn, or the first draw uses a stand-in
export async function loadFonts(design: CoverDesign, customFonts: string[] = []): Promise<void> {
  const used = [...new Set(design.layers.filter((l): l is TextLayer => l.kind === 'text').map(l => l.font))];
  used.filter(f => !customFonts.includes(f)).forEach(f => fontLoader.loadGoogleFont(f));
  try {
    await Promise.race([
      Promise.all(used.flatMap(f => [`400 20px "${f}"`, `italic 400 20px "${f}"`, `700 20px "${f}"`, `italic 700 20px "${f}"`].map(spec => document.fonts.load(spec)))),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
  } catch { /* offline: the stand-in font is used for the screen and the file alike */ }
}

export function renderToCanvas(design: CoverDesign, g: Geometry, opts: RenderOpts): HTMLCanvasElement {
  const view = opts.view ?? { x: 0, y: 0, w: g.totalW, h: g.totalH };
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(view.w * opts.ppi));
  canvas.height = Math.max(1, Math.round(view.h * opts.ppi));
  drawCover(canvas.getContext('2d')!, design, g, opts);
  return canvas;
}

export const toBlob = (canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.93) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make the file.'))), type, quality));
