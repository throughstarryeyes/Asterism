import { describe, expect, it } from 'vitest';
import { cleanPairing, findPairing, pairingFor } from '../pairings';
import { EDGE_VARS, PATTERNS, cleanEdge, cleanTexture, edgeLook, findEdge, findTexture, textureFrom, type PatternKind } from '../surfaces';
import { cleanShelf, cleanSkin, findShelf, skinLook } from '../looks';
import { MAX_BUNDLE, cleanBundle, splitId, wornIds } from '../bundles';
import { MADE, MADE_KINDS, parseMade } from '../made';

describe('made fonts', () => {
  it('strips what could break css and falls back', () => {
    const p = cleanPairing({ id: 'a', name: ' <i>Mine</i> ', body: 'Fira "Sans"; x{}', heading: '' });
    expect(p.body).toBe('Fira Sans x');
    expect(p.name).toBe('iMine/i');
    expect(cleanPairing({ id: 'b', body: '   ' }).body).toBe('Lora');
  });

  it('is found by id and matches the fonts in use', () => {
    const mine = [cleanPairing({ id: 'custom-1', body: 'Fira Sans', heading: 'Oswald' })];
    expect(findPairing('custom-1', mine).heading).toBe('Oswald');
    expect(findPairing('custom-1').id).toBe('classic');
    expect(pairingFor('Fira Sans', 'Oswald', mine)?.id).toBe('custom-1');
    expect(pairingFor('Fira Sans', 'Oswald')).toBeUndefined();
  });
});

describe('made textures', () => {
  it('draws every pattern', () => {
    (Object.keys(PATTERNS) as PatternKind[]).forEach(pattern => {
      const t = textureFrom(cleanTexture({ id: 'x', pattern }));
      expect(t.image).not.toBe('none');
      expect(t.image.length).toBeGreaterThan(10);
    });
  });

  it('follows the theme by default and takes a chosen color', () => {
    expect(textureFrom(cleanTexture({ id: 'x', pattern: 'lines' })).image).toContain('var(--text-main)');
    expect(textureFrom(cleanTexture({ id: 'x', pattern: 'lines', color: '#AA3355' })).image).toContain('#aa3355');
    expect(cleanTexture({ id: 'x', color: 'red' }).color).toBe('ink');
  });

  it('keeps spacing in range and is found by id', () => {
    expect(cleanTexture({ id: 'x', spacing: 1 }).spacing).toBe(12);
    expect(cleanTexture({ id: 'x', spacing: 999 }).spacing).toBe(48);
    const mine = [cleanTexture({ id: 'custom-1', pattern: 'grid', spacing: 20 })];
    expect(findTexture('custom-1', mine).size).toBe('20px 20px');
    expect(findTexture('custom-1').id).toBe('plain');
  });
});

describe('made margins', () => {
  it('sets the variables and attribute the stylesheet reads', () => {
    const look = edgeLook(cleanEdge({ id: 'x', style: 'rows', glyph: '✿', color: '#112233', inset: 20, line: 'double' }));
    expect(look.attr).toBe('x-rows');
    expect(Object.keys(look.vars).sort()).toEqual([...EDGE_VARS].sort());
    expect(look.vars['--edge-row']).toBe('"✿ ✿ ✿ ✿ ✿ ✿ ✿"');
    expect(look.vars['--edge-width']).toBe('4px');
    expect(look.vars['--edge-color']).toBe('#112233');
  });

  it('keeps one safe character for the mark', () => {
    expect(cleanEdge({ id: 'x', glyph: '"x' }).glyph).toBe('x');
    expect(edgeLook(cleanEdge({ id: 'x', glyph: '\\"' })).vars['--edge-glyph']).toBe('"❦"');
    expect(cleanEdge({ id: 'x', glyph: '  ' }).glyph).toBe('❦');
    expect(cleanEdge({ id: 'x', inset: 2 }).inset).toBe(6);
  });

  it('is found by id', () => {
    expect(findEdge('custom-1', [cleanEdge({ id: 'custom-1', name: 'Mine' })]).name).toBe('Mine');
    expect(findEdge('custom-1').id).toBe('none');
  });
});

describe('made skins and shelves', () => {
  it('describes a skin for the body', () => {
    const look = skinLook(cleanSkin({ id: 'x', header: 'double', windows: 'glow', floating: true, color: '#abcdef' }));
    expect(look.attrs).toEqual({ 'data-sk-header': 'double', 'data-sk-win': 'glow', 'data-sk-float': '1' });
    expect(look.color).toBe('#abcdef');
    expect(skinLook(cleanSkin({ id: 'y', header: 'nope' as never })).attrs['data-sk-header']).toBe('rule');
    expect(skinLook(cleanSkin({ id: 'z' })).color).toBe('var(--accent-gold)');
  });

  it('builds a shelf from four colors', () => {
    const mine = [cleanShelf({ id: 'custom-1', top: '#112233', bottom: '#445566', plank: '#aa7744', label: '#ffffff' })];
    const s = findShelf('custom-1', mine);
    expect(s.case).toContain('#112233');
    expect(s.case).toContain('#445566');
    expect(s.label).toBe('#ffffff');
    expect(findShelf('custom-1').id).toBe('plain');
    expect(cleanShelf({ id: 'x', top: 'red' }).top).toBe('#f2e6cf');
  });
});

describe('made bundles', () => {
  it('keeps well-formed unique ids, up to a limit', () => {
    const b = cleanBundle({ id: 'x', items: ['texture-grain', 'texture-grain', 'bad id', 7 as never, 'confetti-custom-12'] });
    expect(b.items).toEqual(['texture-grain', 'confetti-custom-12']);
    expect(cleanBundle({ id: 'y', items: Array.from({ length: 30 }, (_, i) => `edge-e${i}`) }).items).toHaveLength(MAX_BUNDLE);
  });

  it('lists what is worn, leaving out the defaults', () => {
    expect(wornIds({})).toEqual([]);
    expect(wornIds({ activeTexture: 'plain', activeEdge: 'none', activeCelebration: 'classic' })).toEqual([]);
    expect(wornIds({ activeTexture: 'grain', activeCover: 'custom-5', activeCelebration: 'shooting' })).toEqual(['texture-grain', 'cover-custom-5', 'confetti-shooting']);
    expect(splitId('confetti-custom-5')).toEqual({ category: 'confetti', value: 'custom-5' });
  });
});

describe('everything made travels between devices', () => {
  it('has a list for every kind, and parses what another device sent', () => {
    ['pairing', 'texture', 'edge', 'skin', 'shelf', 'bundle', 'cover', 'celebration'].forEach(k => expect(MADE_KINDS).toContain(k));
    const made = parseMade({ texture: [{ id: 'custom-1', pattern: 'dots' }, { pattern: 'lines' }], bundle: [{ id: 'b', items: ['edge-gilt'] }] });
    expect(made.texture).toHaveLength(1);
    expect((made.bundle?.[0] as unknown as { items: string[] }).items).toEqual(['edge-gilt']);
  });

  it('puts the worn setting back when the item goes away', () => {
    expect(MADE.texture.worn).toEqual({ field: 'activeTexture', fallback: 'plain' });
    expect(MADE.edge.worn).toEqual({ field: 'activeEdge', fallback: 'none' });
    expect(MADE.skin.worn).toEqual({ field: 'activeSkin', fallback: 'plain' });
    expect(MADE.shelf.worn).toEqual({ field: 'activeShelf', fallback: 'plain' });
  });
});

describe('system fonts', () => {
  it('know their look-alikes and are not fetched from Google', async () => {
    const { isSystemFont, systemStack, SYSTEM_FONTS } = await import('../systemFonts');
    const { fontStack } = await import('../pairings');
    expect(SYSTEM_FONTS).toEqual(expect.arrayContaining(['Times New Roman', 'Helvetica', 'Arial']));
    expect(isSystemFont('Times New Roman')).toBe(true);
    expect(isSystemFont('Lora')).toBe(false);
    expect(systemStack('Helvetica')).toContain('Arial');
    expect(fontStack('Times New Roman')).toContain('Times');
    expect(fontStack('Lora')).toBe('"Lora", Georgia, serif');
  });
});

describe('sharing what you made', () => {
  it('round-trips every kind through a file and gives it a new id', async () => {
    const { SHARE_KINDS, parseShared, shareFile } = await import('../shareMade');
    const { cleanCelebration } = await import('../celebrations');
    const mine = cleanCelebration({ id: 'custom-1', name: 'Mine', shapes: ['❄'], colors: ['#112233'], effect: 'snowfall' });
    const file = shareFile('celebration', mine);
    expect(file.fileName).toBe('mine.celebration.asterism.json');
    const got = parseShared(file.text, () => 'custom-new');
    expect('error' in got).toBe(false);
    if ('error' in got) return;
    expect(got.kind).toBe('celebration');
    expect(got.item).toEqual({ ...mine, id: 'custom-new' });
    // everything the writer can make can be shared, bundles and palettes too
    expect(SHARE_KINDS).toContain('bundle');
    expect(SHARE_KINDS).toContain('palette');
  });

  it('shares a palette without the story it belonged to', async () => {
    const { parseShared, shareFile } = await import('../shareMade');
    const file = shareFile('palette', { id: 'custom-p', name: 'Dusk', colors: ['#112233', '#445566', '#778899'], notes: '', projectId: 'story-1' } as { id: string; name: string });
    const got = parseShared(file.text, () => 'custom-new');
    if ('error' in got) throw new Error(got.error);
    expect(got.kind).toBe('palette');
    expect((got.item as { projectId?: string }).projectId).toBeUndefined();
  });

  it('refuses anything that is not a cosmetic file', async () => {
    const { parseShared, SHARE_TYPE } = await import('../shareMade');
    expect('error' in parseShared('not json')).toBe(true);
    expect('error' in parseShared('{"hello":1}')).toBe(true);
    expect('error' in parseShared(JSON.stringify({ type: SHARE_TYPE, kind: 'soundscape', item: { id: 'x' } }))).toBe(true);
    expect('error' in parseShared(JSON.stringify({ type: SHARE_TYPE, kind: 'cover', item: null }))).toBe(true);
    expect('error' in parseShared('x'.repeat(300 * 1024))).toBe(true);
  });

  it('cleans what a stranger wrote, with the same code as our own', async () => {
    const { parseShared, SHARE_TYPE } = await import('../shareMade');
    const got = parseShared(JSON.stringify({ type: SHARE_TYPE, kind: 'edge', item: { id: 'theirs', name: '<b>Hi</b>', glyph: '"x', color: 'url(evil)', inset: 9999, junk: 1 } }), () => 'custom-a');
    if ('error' in got) throw new Error(got.error);
    expect(got.item).toEqual({ id: 'custom-a', name: 'bHi/b', style: 'border', line: 'solid', glyph: 'x', color: 'accent', inset: 32 });
  });
});

describe('comment marks have a color of their own', () => {
  it('follows the card unless told otherwise', async () => {
    const { cleanShape, shapeStyle } = await import('../shapes');
    const base = { id: 'custom-1', name: 'a', color: '#aa0000' };
    expect(shapeStyle(cleanShape(base))?.vars['--cs-mark']).toBe('#aa0000');
    expect(shapeStyle(cleanShape({ ...base, markColor: '#0000aa' }))?.vars['--cs-mark']).toBe('#0000aa');
    expect(shapeStyle(cleanShape({ ...base, markColor: '#0000aa' }))?.vars['--cs-color']).toBe('#aa0000');
    expect(shapeStyle(cleanShape({ ...base, markColor: 'accent' }))?.vars['--cs-mark']).toBe('var(--accent-gold)');
    expect(cleanShape({ ...base, markColor: 'nonsense' }).markColor).toBe('same');
  });
});

describe('turning confetti off', () => {
  it('has its own card and is free', async () => {
    const { CATALOG } = await import('../shop');
    const none = CATALOG.find(i => i.id === 'confetti-none');
    expect(none?.cost).toBe(0);
    expect(none?.category).toBe('confetti');
  });
});
