import { describe, expect, it } from 'vitest';
import {
  BLEED, MAX_LAYERS, PAPER_TYPES, SAFE, cleanCover, cleanLayer, coverAssetIds, duplicateLayer, estimatePages, geometry, imageLayer, moveLayer, shapeLayer,
  spineText, spineWidth, starterCover, textLayer, type CoverDesign,
} from '../cover/design';
import { jpegToPdf } from '../cover/pdf';

const setup = { pages: 300, paper: 'bw-white' };

describe('cover size', () => {
  it('works out the spine from the pages and the paper', () => {
    expect(spineWidth({ pages: 300, paper: 'bw-white' })).toBe(0.676);
    expect(spineWidth({ pages: 300, paper: 'bw-cream' })).toBeCloseTo(0.75, 3);
    expect(spineWidth({ pages: 300, paper: 'color-premium' })).toBeCloseTo(0.704, 3);
    expect(spineWidth({ pages: 300, paper: 'nonsense' })).toBe(0.676);
    expect(PAPER_TYPES.every(p => p.perPage > 0.002 && p.perPage < 0.003)).toBe(true);
  });

  it('takes the printer number for the spine when one is given', () => {
    expect(spineWidth({ pages: 300, paper: 'bw-white', spineOverride: 0.5 })).toBe(0.5);
    expect(spineWidth({ pages: 300, paper: 'bw-white', spineOverride: 0 })).toBe(0);
  });

  it('lays back, spine and front side by side with bleed all round', () => {
    const g = geometry(6, 9, setup);
    expect(g.totalW).toBeCloseTo(6 * 2 + 0.676 + BLEED * 2, 3);
    expect(g.totalH).toBeCloseTo(9 + BLEED * 2, 3);
    expect(g.back.x).toBe(BLEED);
    expect(g.spineRect.x).toBeCloseTo(BLEED + 6, 3);
    expect(g.front.x).toBeCloseTo(BLEED + 6 + 0.676, 3);
    expect(g.front.x + g.front.w + BLEED).toBeCloseTo(g.totalW, 3);
  });

  it('puts the barcode low on the back, a quarter inch in from the trim, and inside the cover', () => {
    const g = geometry(6, 9, setup);
    expect(g.barcode.w).toBe(2);
    expect(g.barcode.h).toBe(1.2);
    expect(g.barcode.x + g.barcode.w).toBeCloseTo(g.back.x + g.back.w - SAFE, 3);
    expect(g.barcode.y + g.barcode.h).toBeCloseTo(g.back.y + g.back.h - SAFE, 3);
    expect(g.barcode.x).toBeGreaterThan(g.back.x);
  });

  it('guesses the pages from the words, in even numbers, never too few', () => {
    const small = estimatePages(1000, 4.6, 7.5, 11, 1.45);
    const novel = estimatePages(80000, 4.6, 7.5, 11, 1.45);
    expect(small).toBeGreaterThanOrEqual(24);
    expect(small % 2).toBe(0);
    expect(novel % 2).toBe(0);
    expect(novel).toBeGreaterThan(200);
    expect(novel).toBeLessThan(500);
    expect(estimatePages(80000, 4.6, 7.5, 14, 1.6)).toBeGreaterThan(novel);
  });
});

describe('cleaning a cover', () => {
  it('keeps what is good and fixes what is not', () => {
    const c = cleanCover({
      setup: { pages: 1, paper: 'gold', spineOverride: -3 },
      background: { kind: 'solid', color: 'pink' },
      layers: [
        { kind: 'text', id: 'a', text: 'Hi', size: 9999, opacity: 7, fill: { kind: 'solid', color: '#ABCDEF' }, effects: { shadow: { x: 99, color: 'red' } } },
        { kind: 'image' },
        { kind: 'shape', id: 'b', shape: 'blob' },
        null,
      ],
    })!;
    expect(c.setup).toEqual({ pages: 24, paper: 'bw-white' });
    expect(c.background).toEqual({ kind: 'solid', color: '#1f2a44' });
    expect(c.layers).toHaveLength(2);
    const t = c.layers[0];
    expect(t).toMatchObject({ kind: 'text', size: 400, opacity: 1 });
    expect((t as { fill: unknown }).fill).toEqual({ kind: 'solid', color: '#abcdef' });
    expect(t.effects.shadow).toMatchObject({ x: 2, color: '#000000' });
    expect(c.layers[1]).toMatchObject({ kind: 'shape', shape: 'rect' });
  });

  it('drops repeated ids and caps the layers', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ kind: 'shape', id: `l${i}` }));
    expect(cleanCover({ layers: many })!.layers).toHaveLength(MAX_LAYERS);
    expect(cleanCover({ layers: [{ kind: 'shape', id: 'same' }, { kind: 'shape', id: 'same' }] })!.layers).toHaveLength(1);
    expect(cleanCover('nope')).toBeUndefined();
  });

  it('keeps transparency, gradients and every text style', () => {
    const l = cleanLayer({
      kind: 'text', text: 'Title', opacity: 0.4, fillOpacity: 0.7,
      fill: { kind: 'gradient', gradient: { kind: 'linear', angle: 90, stops: [{ color: '#ff0000', at: 0 }, { color: '#0000ff', at: 100 }] } },
      effects: { shadow: { x: 0.05, y: 0.05, blur: 0.1, color: '#112233', opacity: 0.6 }, outline: { width: 3, color: '#ffffff' }, bevel: { depth: 2, light: '#ffffff', dark: '#000000' }, glow: { blur: 0.2, color: '#ffee88' } },
    })!;
    expect(l.opacity).toBe(0.4);
    expect((l as { fillOpacity: number }).fillOpacity).toBe(0.7);
    expect((l as { fill: { kind: string } }).fill.kind).toBe('gradient');
    expect(Object.keys(l.effects).sort()).toEqual(['bevel', 'glow', 'outline', 'shadow']);
  });

  it('refuses a picture with no file', () => {
    expect(cleanLayer({ kind: 'image', assetId: '' })).toBeNull();
    expect(cleanLayer({ kind: 'image', assetId: 'x' })).toMatchObject({ kind: 'image', fit: 'cover' });
  });

  it('lists the pictures a design uses', () => {
    const d: CoverDesign = { setup, background: { kind: 'solid', color: '#000000' }, layers: [imageLayer('a'), textLayer(), imageLayer('b')] };
    expect(coverAssetIds(d)).toEqual(['a', 'b']);
    expect(coverAssetIds(undefined)).toEqual([]);
  });
});

describe('layer order', () => {
  const layers = ['a', 'b', 'c', 'd'].map(id => shapeLayer({ id }));
  const order = (l: { id: string }[]) => l.map(x => x.id).join('');

  it('brings a layer forward or sends it back one place at a time', () => {
    expect(order(moveLayer(layers, 'b', 'forward'))).toBe('acbd');
    expect(order(moveLayer(layers, 'c', 'backward'))).toBe('acbd');
  });

  it('puts a layer at the very front or the very back', () => {
    expect(order(moveLayer(layers, 'a', 'front'))).toBe('bcda');
    expect(order(moveLayer(layers, 'd', 'back'))).toBe('dabc');
  });

  it('leaves the order alone at the ends, and for a layer that is not there', () => {
    expect(moveLayer(layers, 'd', 'forward')).toBe(layers);
    expect(moveLayer(layers, 'a', 'backward')).toBe(layers);
    expect(moveLayer(layers, 'zzz', 'front')).toBe(layers);
  });

  it('copies a layer just above itself, nudged over', () => {
    const r = duplicateLayer(layers, 'b');
    expect(r.layers).toHaveLength(5);
    expect(r.layers[2].id).toBe(r.id);
    expect(r.layers[2].x).toBeCloseTo(layers[1].x + 0.2, 3);
    expect(r.id).not.toBe('b');
    expect(duplicateLayer(layers, 'nope').id).toBeNull();
  });
});

describe('the first design', () => {
  const g = geometry(6, 9, setup);
  const d = starterCover(g, { title: 'The Lamp', author: 'Ada', synopsis: 'A story.' }, setup);

  it('has words and no pictures', () => {
    expect(d.layers.some(l => l.kind === 'image')).toBe(false);
    expect(d.layers.map(l => l.name)).toEqual(expect.arrayContaining(['Title', 'Author', 'Back cover text', 'Spine']));
  });

  it('keeps the title and author on the front, inside the safe area', () => {
    for (const l of d.layers.filter(x => x.name === 'Title' || x.name === 'Author')) {
      expect(l.x).toBeGreaterThanOrEqual(g.front.x + SAFE);
      expect(l.x + l.w).toBeLessThanOrEqual(g.front.x + g.trimW - SAFE + 0.001);
    }
  });

  it('turns the spine text a quarter turn and centers it on the spine', () => {
    const s = spineText(g, 'The Lamp');
    expect(s.rotation).toBe(90);
    expect(s.x + s.w / 2).toBeCloseTo(g.spineRect.x + g.spine / 2, 2);
    expect(s.y + s.h / 2).toBeCloseTo(g.spineRect.y + g.spineRect.h / 2, 2);
    expect(s.w).toBeLessThanOrEqual(g.trimH);
  });

  it('leaves spine text out when the spine is too thin to hold it', () => {
    const thin = { pages: 30, paper: 'bw-white' };
    const g2 = geometry(6, 9, thin);
    expect(starterCover(g2, { title: 'T', author: 'A', synopsis: '' }, thin).layers.some(l => l.name === 'Spine')).toBe(false);
  });
});

describe('the print file', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 4, 5, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 3750, 2775, 12.5, 9.25);
  const text = new TextDecoder('latin1').decode(pdf);

  it('is one page at the exact size, in points', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain(`/MediaBox [0 0 ${12.5 * 72} ${9.25 * 72}]`);
    expect(text).toContain('/Count 1');
    expect(text).toContain('/Width 3750 /Height 2775');
    expect(text).toContain('/DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('holds the picture bytes untouched', () => {
    let at = -1;
    for (let i = 0; i + jpeg.length <= pdf.length && at < 0; i++) if (jpeg.every((b, j) => pdf[i + j] === b)) at = i;
    expect(at).toBeGreaterThan(0);
  });

  it('points to every object where it really is', () => {
    const start = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const entries = text.slice(start).split('\n').filter(l => /^\d{10} 00000 n/.test(l));
    expect(entries).toHaveLength(5);
    entries.forEach((e, i) => expect(text.slice(Number(e.slice(0, 10)), Number(e.slice(0, 10)) + 6)).toBe(`${i + 1} 0 ob`));
  });
});
