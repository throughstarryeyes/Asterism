import { describe, it, expect } from 'vitest';
import { worldFindings, worldNames } from '../storyWorld';
import { buildEntityIndex, type CoachUnit } from '../coach/entities';
import { MUSE_FOUNDATION_CARDS } from '../../data/museFoundations';
import type { LocationProfile, LoreEntry } from '../../types';

const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';
const scenes = (...texts: string[]): CoachUnit[] => texts.map((t, i) => ({ id: `u${i}`, index: i, title: `Scene ${i + 1}`, chapterId: `c${i}`, plainText: t }));
const five = (extra = '') => scenes(`Mara crossed the town. ${extra}`, quiet, quiet, quiet, quiet);
const place = (name: string, over: Partial<LocationProfile> = {}): LocationProfile => ({ id: name, name, type: '', atmosphere: '', sensoryDetails: '', significance: '', ...over });
const lore = (title: string, over: Partial<LoreEntry> = {}): LoreEntry => ({ id: title, title, category: 'custom', content: '', ...over });

describe('places and lore the manuscript has not used', () => {
  it('asks about a place no scene names, and links a setting card', () => {
    const found = worldFindings({ units: five(), bible: { locations: [place('Greywatch Keep', { significance: 'where the ledger is hidden' })], lore: [] } });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 'finding-world-place-greywatch-keep', category: 'expansion', confidence: 'possible_exploration' });
    expect(found[0].summary).toContain('where the ledger is hidden');
    expect(MUSE_FOUNDATION_CARDS.some(c => c.id === found[0].linkedFoundationCardId)).toBe(true);
  });

  it('is quiet once the place appears, by its name or another name', () => {
    const keep = place('Greywatch Keep', { aliases: ['the Keep'] });
    expect(worldFindings({ units: five('She walked into Greywatch Keep.'), bible: { locations: [keep], lore: [] } })).toEqual([]);
    expect(worldFindings({ units: five('She walked into the keep.'), bible: { locations: [keep], lore: [] } })).toEqual([]);
    expect(worldFindings({ units: five('She walked into Orchard Lane.'), bible: { locations: [place('The Orchard Lane')], lore: [] } })).toEqual([]);
  });

  it('looks for lore by its title, and for an idea by its words together', () => {
    const bible = { locations: [], lore: [lore('The Great Bell'), lore('Magic always costs memory')] };
    expect(worldFindings({ units: five(), bible }).map(f => f.id)).toEqual(['finding-world-lore-the-great-bell', 'finding-world-lore-magic-always-costs-memory']);
    expect(worldFindings({ units: five('The Great Bell tolled. Her magic cost her a memory.'), bible })).toEqual([]);
  });

  it('says nothing about a short draft', () => {
    expect(worldFindings({ units: scenes('Mara crossed the town.', quiet), bible: { locations: [place('Greywatch Keep')], lore: [lore('The Great Bell')] } })).toEqual([]);
  });

  it('lists the names that are places and groups, not people', () => {
    expect(worldNames({ locations: [place('The Harbor', { aliases: ['the docks'] }), place('Hi')], lore: [lore('The Guild of Clocks')] })).toEqual(['Harbor', 'docks', 'Guild of Clocks']);
  });

  it('keeps a place name from becoming a character', () => {
    const units = scenes('Mara spoke with Greywatch about the Orchard Lane. Greywatch nodded. Greywatch left.');
    const withBible = buildEntityIndex(units, [{ name: 'Mara' }], ['Greywatch']).entities.map(e => e.canonical);
    expect(withBible).not.toContain('Greywatch');
  });
});
