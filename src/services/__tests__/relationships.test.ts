import { describe, it, expect } from 'vitest';
import { cleanTag, expectsScenes, isClose, relationBetween, tagLabel, tagsOf, withRelation } from '../relationships';
import type { CharacterProfile } from '../../types';

const card = (id: string, over: Partial<CharacterProfile> = {}): CharacterProfile => ({
  id, name: id[0].toUpperCase() + id.slice(1), role: 'supporting', coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription: '', theSecret: '', relationships: [], ...over,
});

describe('relationship tags', () => {
  it('reads tags out of older free text, and trusts chosen tags over it', () => {
    expect(tagsOf({ relationshipType: 'Elder Brother & Mentor' })).toEqual(['familial', 'mentor']);
    expect(tagsOf({ relationshipType: 'Former Guildmaster & Secret Protector' })).toEqual([]);
    expect(tagsOf({ relationshipType: 'Elder Brother', types: ['rival'] })).toEqual(['rival']);
    expect(tagsOf({ relationshipType: 'her husband' })).toEqual(['romantic']);
  });

  it('puts what both cards say about a pair together', () => {
    const mara = card('mara', { relationships: [{ targetCharacterId: 'corin', targetName: 'Corin', relationshipType: '', notes: 'since school', types: ['classmate'] }] });
    const corin = card('corin', { relationships: [{ targetCharacterId: 'mara', targetName: 'Mara', relationshipType: 'my sister', notes: '' }] });
    const rel = relationBetween(mara, corin);
    expect([...rel.types].sort()).toEqual(['classmate', 'familial']);
    expect(rel.notes).toEqual(['since school']);
    expect(relationBetween(mara, card('dana'))).toEqual({ types: [], notes: [] });
  });

  it('sets, replaces and removes a relationship on a card', () => {
    const mara = card('mara');
    const corin = card('corin');
    const once = withRelation(mara, corin, ['familial', 'mentor'], 'raised him');
    expect(once.relationships).toHaveLength(1);
    expect(once.relationships[0]).toMatchObject({ targetCharacterId: 'corin', types: ['familial', 'mentor'], notes: 'raised him', relationshipType: 'Family, Mentor' });
    const twice = withRelation(once, corin, ['familial'], 'raised him');
    expect(twice.relationships).toHaveLength(1);
    expect(withRelation(twice, corin, [], '').relationships).toEqual([]);
    expect(withRelation(twice, corin, [], 'just a note').relationships).toHaveLength(1);
  });

  it('knows which ties are close and which expect shared scenes', () => {
    expect(isClose(['familial'])).toBe(true);
    expect(isClose(['acquaintance', 'business'])).toBe(false);
    expect(expectsScenes(['classmate'])).toBe(true);
    expect(expectsScenes(['acquaintance', 'neighbor'])).toBe(false);
  });

  it('cleans a tag the writer typed, and names the built-in ones', () => {
    expect(cleanTag('  <Godparent> ')).toBe('godparent');
    expect(tagLabel('business')).toBe('Business partners');
    expect(tagLabel('godparent')).toBe('godparent');
  });
});
