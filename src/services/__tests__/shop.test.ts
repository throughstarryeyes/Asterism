import { describe, expect, it } from 'vitest';
import { CATALOG, EARNED, MIN_PRICE, isOwned, tierOf } from '../shop';
import { FLOURISHES, MAX_MARK, SEPARATORS, cleanFlourish, cleanSeparator, findFlourish, flourishFrame, separatorHtml } from '../ornaments';
import { MAX_COUNT, MIN_COUNT, PRESET_LOADERS, cleanLoader, cycleSeconds, findLoader, layoutPoints } from '../loaders';
import { splitScenes } from '../openDraft';

describe('shop catalog', () => {
  it('has unique ids and sane prices', () => {
    const ids = CATALOG.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    CATALOG.forEach(i => {
      expect(i.cost === 0 || i.cost >= MIN_PRICE).toBe(true);
      expect(i.tier).toBe(i.earnedWith ? 'earned' : tierOf(i.cost));
    });
  });

  it('puts prices in the agreed tiers', () => {
    expect(tierOf(0)).toBe('free');
    expect(tierOf(30)).toBe('common');
    expect(tierOf(80)).toBe('common');
    expect(tierOf(100)).toBe('uncommon');
    expect(tierOf(200)).toBe('uncommon');
    expect(tierOf(300)).toBe('rare');
  });

  it('treats free items as owned and paid ones as owned only once bought', () => {
    const free = CATALOG.find(i => i.cost === 0)!;
    const paid = CATALOG.find(i => i.cost > 0)!;
    expect(isOwned(free, [])).toBe(true);
    expect(isOwned(paid, [])).toBe(false);
    expect(isOwned(paid, [paid.id])).toBe(true);
  });

  it('sells the new categories and keeps a free choice in each', () => {
    (['loader', 'separator', 'flourish'] as const).forEach(c => {
      const inCat = CATALOG.filter(i => i.category === c);
      expect(inCat.length).toBeGreaterThan(2);
      expect(inCat.some(i => i.cost === 0)).toBe(true);
    });
  });
});

describe('scene break styles', () => {
  it('keeps the classic * * * as the default', () => {
    expect(separatorHtml()).toContain('* * *');
    expect(separatorHtml('nope')).toBe(separatorHtml('stars'));
  });

  it.each(SEPARATORS.map(s => s.id))('%s splits a scene in two and leaves no stray ornament', id => {
    const html = `<p>before</p>${separatorHtml(id)}<p>after</p>`;
    expect(separatorHtml(id)).toContain('<hr');
    const scenes = splitScenes(html);
    expect(scenes).toEqual(['<p>before</p>', '<p>after</p>']);
  });
});

describe('title page flourishes', () => {
  it('has a bare one that draws nothing', () => {
    const none = FLOURISHES.find(f => f.id === 'none')!;
    expect(none.top + none.bottom).toBe('');
    expect(flourishFrame(none)).toBeUndefined();
  });

  it('draws frames only for the framed ones', () => {
    expect(flourishFrame(FLOURISHES.find(f => f.id === 'frame')!)).toBeDefined();
    expect(flourishFrame(FLOURISHES.find(f => f.id === 'gilt')!)).toBeDefined();
  });
});

describe('loaders', () => {
  it('keeps the ids the first three always had', () => {
    ['stars', 'orbit', 'constellation'].forEach(id => expect(PRESET_LOADERS.some(l => l.id === id)).toBe(true));
  });

  it('falls back to the first loader for unknown ids and finds custom ones', () => {
    expect(findLoader('missing').id).toBe('stars');
    const mine = cleanLoader({ id: 'custom-1', name: 'Mine', shape: 'heart' });
    expect(findLoader('custom-1', [mine]).shape).toBe('heart');
  });

  it('keeps a made-up loader inside what the animation can draw', () => {
    const l = cleanLoader({ id: 'x', name: '   ', shape: 'bogus' as never, layout: 'bogus' as never, count: 99, step: 50, color: 'red' });
    expect(l.name).toBe('My loader');
    expect(l.shape).toBe('star');
    expect(l.layout).toBe('row');
    expect(l.count).toBe(MAX_COUNT);
    expect(l.step).toBeLessThanOrEqual(0.6);
    expect(l.color).toBe('accent');
    expect(cleanLoader({ id: 'y', count: 1, color: '#ff00aa' }).count).toBe(MIN_COUNT);
    expect(cleanLoader({ id: 'y', color: '#ff00aa' }).color).toBe('#ff00aa');
  });

  it('places one point per shape and gives every loop time to rest', () => {
    (['ring', 'arc', 'wave', 'constellation', 'row'] as const).forEach(layout => {
      for (let n = MIN_COUNT; n <= MAX_COUNT; n++) {
        const pts = layoutPoints(layout, n);
        expect(pts).toHaveLength(n);
        pts.forEach(([x, y]) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(100); });
      }
    });
    PRESET_LOADERS.forEach(l => expect(cycleSeconds(l)).toBeGreaterThan(l.count * l.step));
  });
});

describe('made-by-you scene breaks and flourishes', () => {
  it('keeps typed ornaments from becoming html', () => {
    const mine = cleanSeparator({ id: 'custom-1', name: '', mark: '<b>x</b>&', rule: 'bogus' as never });
    expect(mine.name).toBe('My scene break');
    expect(mine.rule).toBe('none');
    const html = separatorHtml('custom-1', [mine]);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('trims long ornaments and splits scenes like the built-in ones', () => {
    const mine = cleanSeparator({ id: 'custom-2', mark: 'x'.repeat(50), gold: true });
    expect(mine.mark).toHaveLength(MAX_MARK);
    expect(splitScenes(`<p>a</p>${separatorHtml('custom-2', [mine])}<p>b</p>`)).toEqual(['<p>a</p>', '<p>b</p>']);
    expect(splitScenes(`<p>a</p>${separatorHtml('custom-2', [cleanSeparator({ id: 'custom-3', mark: '' })])}<p>b</p>`)).toHaveLength(2);
  });

  it('finds a made flourish and cleans its lines and frame', () => {
    const f = cleanFlourish({ id: 'custom-4', top: ' ✦ \n ✦ ', bottom: 'y'.repeat(40), frame: 'bogus' as never });
    expect(f.top).toMatch(/^✦ +✦$/);
    expect(f.bottom).toHaveLength(MAX_MARK);
    expect(f.frame).toBeUndefined();
    expect(findFlourish('custom-4', [f]).id).toBe('custom-4');
    expect(findFlourish('gone', [f]).id).toBe('none');
  });
});

describe('earned and new categories', () => {
  it('keeps something free in every kind of look the shop sells', () => {
    (['cursor', 'trail', 'chime', 'shape', 'skin', 'cover', 'shelf'] as const).forEach(c => {
      const inCat = CATALOG.filter(i => i.category === c);
      expect(inCat.length).toBeGreaterThan(2);
      expect(inCat.some(i => i.cost === 0 && !i.earnedWith)).toBe(true);
    });
  });

  it('only unlocks streak keepsakes with their badge, never with points', () => {
    Object.entries(EARNED).forEach(([id, badge]) => {
      const item = CATALOG.find(i => i.id === id)!;
      expect(item).toBeDefined();
      expect(item.cost).toBe(0);
      expect(isOwned(item, [id], [])).toBe(false);
      expect(isOwned(item, [], [badge])).toBe(true);
    });
  });
});
