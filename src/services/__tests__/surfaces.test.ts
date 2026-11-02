import { describe, expect, it } from 'vitest';
import { SEASON_GOAL, addSeasonWords, inSeason, progressNow, seasonKey, seasonOf } from '../seasons';
import { EDGES, TEXTURES, findEdge, findTexture } from '../surfaces';
import { PAIRINGS, findPairing, pairingFor } from '../pairings';
import { CATALOG, EARNED, PACKS, isOwned } from '../shop';

describe('seasons', () => {
  it('splits the year into four, with winter wrapping New Year', () => {
    expect(seasonOf(new Date(2026, 0, 15))).toBe('winter');
    expect(seasonOf(new Date(2026, 1, 28))).toBe('winter');
    expect(seasonOf(new Date(2026, 2, 1))).toBe('spring');
    expect(seasonOf(new Date(2026, 5, 1))).toBe('summer');
    expect(seasonOf(new Date(2026, 8, 1))).toBe('autumn');
    expect(seasonOf(new Date(2026, 11, 1))).toBe('winter');
  });

  it('counts January and February with the winter that began the year before', () => {
    expect(seasonKey(new Date(2026, 11, 20))).toBe('winter-2026');
    expect(seasonKey(new Date(2027, 0, 20))).toBe('winter-2026');
    expect(seasonKey(new Date(2027, 3, 1))).toBe('spring-2027');
  });

  it('adds words, pays once at the goal, and starts fresh in a new season', () => {
    const day = new Date(2026, 9, 5);
    let r = addSeasonWords(undefined, 6000, day);
    expect(r.done).toBe(false);
    r = addSeasonWords(r.state, SEASON_GOAL, day);
    expect(r.done).toBe(true);
    expect(r.state.paid).toBe(true);
    expect(addSeasonWords(r.state, 500, day).done).toBe(false);
    const next = addSeasonWords(r.state, 100, new Date(2026, 11, 3));
    expect(next.state).toMatchObject({ key: 'winter-2026', words: 100 });
    expect(next.state.paid).toBeUndefined();
  });

  it('shows no progress from an older season', () => {
    expect(progressNow({ key: 'autumn-2025', words: 9000 }, new Date(2026, 9, 5)).words).toBe(0);
    expect(progressNow({ key: 'autumn-2026', words: 900 }, new Date(2026, 9, 5)).words).toBe(900);
  });

  it('sells seasonal things only in their season', () => {
    expect(inSeason(undefined)).toBe(true);
    expect(inSeason('autumn', new Date(2026, 9, 5))).toBe(true);
    expect(inSeason('winter', new Date(2026, 9, 5))).toBe(false);
  });
});

describe('textures and margins', () => {
  it('has a free plain choice and unique ids', () => {
    expect(TEXTURES[0]).toMatchObject({ id: 'plain', cost: 0, image: 'none' });
    expect(EDGES[0]).toMatchObject({ id: 'none', cost: 0 });
    expect(new Set(TEXTURES.map(t => t.id)).size).toBe(TEXTURES.length);
    expect(new Set(EDGES.map(e => e.id)).size).toBe(EDGES.length);
    expect(findTexture('nope').id).toBe('plain');
    expect(findEdge('nope').id).toBe('none');
  });

  it('has one texture and one margin for every season', () => {
    (['winter', 'spring', 'summer', 'autumn'] as const).forEach(s => {
      expect(TEXTURES.some(t => t.season === s)).toBe(true);
      expect(EDGES.some(e => e.season === s)).toBe(true);
    });
  });
});

describe('font pairings', () => {
  it('offers an easy-reading pairing for free', () => {
    expect(PAIRINGS.find(p => p.id === 'readable')?.cost).toBe(0);
    expect(findPairing('nope').id).toBe('classic');
  });

  it('recognizes the pairing that matches the fonts in use', () => {
    expect(pairingFor('Merriweather', 'Playfair Display')?.id).toBe('storybook');
    expect(pairingFor('Lora', undefined)?.id).toBe('classic');
    expect(pairingFor('Lora', 'Cinzel')).toBeUndefined();
  });
});

describe('bundles and seasonal keepsakes', () => {
  it('only bundles things that exist, and prices them under the sum', () => {
    PACKS.forEach(p => {
      const bundle = CATALOG.find(i => i.id === `pack-${p.id}`)!;
      expect(bundle.contains).toEqual(p.items);
      const parts = p.items.map(id => CATALOG.find(i => i.id === id));
      parts.forEach((part, i) => expect(part, p.items[i]).toBeDefined());
      const sum = parts.reduce((n, part) => n + (part?.cost ?? 0), 0);
      expect(bundle.cost).toBeLessThan(sum);
      expect(bundle.cost).toBeGreaterThan(0);
    });
  });

  it('keeps earned and seasonal-only things out of bundles', () => {
    const earned = new Set(Object.keys(EARNED));
    PACKS.forEach(p => p.items.forEach(id => {
      expect(earned.has(id)).toBe(false);
      expect(CATALOG.find(i => i.id === id)?.season).toBeUndefined();
    }));
  });

  it('gives each season a cover that only its badge unlocks', () => {
    ['winter', 'spring', 'summer', 'autumn'].forEach(s => {
      const id = Object.keys(EARNED).find(k => EARNED[k] === `badge-season-${s}`)!;
      const cover = CATALOG.find(i => i.id === id)!;
      expect(cover.category).toBe('cover');
      expect(isOwned(cover, [id], [])).toBe(false);
      expect(isOwned(cover, [], [`badge-season-${s}`])).toBe(true);
    });
  });
});
