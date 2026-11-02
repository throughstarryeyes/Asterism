import { describe, it, expect } from 'vitest';
import {
  addChoice, addNode, autoArrange, branchOut, checkStory, newChoice, newNode, nodeById, readingOrder,
  reachable, removeNode, sanitizeStory, starterStory, storyStats, updateChoice, updateNode, MAX_CHOICES,
  type BranchingStory,
} from '../branching';
import { buildPlayableHtml, embedJson, playData, renderText } from '../branchingExport';

describe('building a branching story', () => {
  it('the starter story can be played start to finish', () => {
    const s = starterStory();
    expect(checkStory(s)).toEqual([]);
    expect(storyStats(s)).toEqual({ scenes: 4, endings: 1, choices: 4, paths: 2 });
  });

  it('an ending drops its choices', () => {
    const s = starterStory();
    const ended = updateNode(s, s.nodes[0].id, { ending: true });
    expect(nodeById(ended, s.nodes[0].id)!.choices).toEqual([]);
  });

  it('removing a scene clears the choices that led to it and moves the start if needed', () => {
    const s = starterStory();
    const target = s.nodes[1];
    const out = removeNode(s, target.id);
    expect(out.nodes.some(n => n.id === target.id)).toBe(false);
    expect(out.nodes[0].choices.some(c => c.to === target.id)).toBe(false);
    expect(out.nodes[0].choices.some(c => c.to === '')).toBe(true);
    const noStart = removeNode(s, s.startId);
    expect(noStart.startId).toBe(noStart.nodes[0].id);
  });

  it('limits choices per scene and none on endings', () => {
    let s = starterStory();
    const id = s.startId;
    for (let i = 0; i < 10; i++) s = addChoice(s, id, newChoice(`c${i}`));
    expect(nodeById(s, id)!.choices).toHaveLength(MAX_CHOICES);
    const end = s.nodes.find(n => n.ending)!;
    expect(addChoice(s, end.id).nodes.find(n => n.id === end.id)!.choices).toHaveLength(0);
  });

  it('branching out makes a connected scene to the right', () => {
    const s = starterStory();
    const from = s.nodes[3];
    const withChoice = addChoice(updateNode(s, from.id, { ending: false }), from.id, newChoice('More'));
    const choice = nodeById(withChoice, from.id)!.choices[0];
    const out = branchOut(withChoice, from.id, choice.id, 'Next');
    const made = nodeById(out.story, out.id)!;
    expect(made.title).toBe('Next');
    expect(made.x).toBeGreaterThan(from.x);
    expect(nodeById(out.story, from.id)!.choices[0].to).toBe(out.id);
  });
});

describe('checking a story', () => {
  it('finds unreachable scenes, dead ends and open choices', () => {
    let s = starterStory();
    s = addNode(s, newNode('Lost', 0, 0));
    const lost = s.nodes[s.nodes.length - 1];
    s = addChoice(s, s.startId, newChoice('Nowhere'));
    const problems = checkStory(s);
    const kinds = problems.map(p => p.kind);
    expect(kinds).toContain('unreachable');
    expect(kinds).toContain('dead-end');
    expect(kinds).toContain('open-choice');
    expect(problems.find(p => p.kind === 'unreachable')!.nodeId).toBe(lost.id);
  });

  it('flags a choice with no words and a story with no ending', () => {
    let s = starterStory();
    s = updateChoice(s, s.startId, s.nodes[0].choices[0].id, { label: '  ' });
    expect(checkStory(s).map(p => p.kind)).toContain('empty-choice');
    const end = s.nodes.find(n => n.ending)!;
    expect(checkStory(updateNode(s, end.id, { ending: false })).map(p => p.kind)).toContain('no-ending');
  });

  it('follows loops without hanging', () => {
    const s = starterStory();
    const a = s.nodes[1];
    const looped = updateChoice(s, a.id, a.choices[0].id, { to: s.startId });
    expect(reachable(looped).has(s.startId)).toBe(true);
    expect(storyStats(looped).paths).toBeGreaterThanOrEqual(0);
  });

  it('counts paths through a long chain of two-way splits quickly', () => {
    const s: BranchingStory = { title: 't', intro: '', startId: 'n0', nodes: [] };
    for (let i = 0; i < 40; i++) {
      const next = i === 39 ? 'end' : `n${i + 1}`;
      s.nodes.push({ id: `n${i}`, title: `n${i}`, text: '', ending: false, x: 0, y: 0, choices: [{ id: `a${i}`, label: 'a', reaction: '', to: next }, { id: `b${i}`, label: 'b', reaction: '', to: next }] });
    }
    s.nodes.push({ id: 'end', title: 'end', text: '', ending: true, x: 0, y: 0, choices: [] });
    expect(storyStats(s).paths).toBe(1_000_000);
  });
});

describe('layout and order', () => {
  it('arranges scenes in columns by distance from the start', () => {
    const s = autoArrange(starterStory());
    const x = (t: string) => s.nodes.find(n => n.title === t)!.x;
    expect(x('The beginning')).toBeLessThan(x('One way'));
    expect(x('One way')).toBe(x('Another way'));
    expect(x('One way')).toBeLessThan(x('The end'));
    expect(new Set(s.nodes.map(n => `${n.x},${n.y}`)).size).toBe(s.nodes.length);
  });

  it('reading order starts at the start and puts strays last', () => {
    let s = starterStory();
    s = addNode(s, newNode('Stray', 0, 0));
    const order = readingOrder(s);
    expect(order[0].id).toBe(s.startId);
    expect(order[order.length - 1].title).toBe('Stray');
  });
});

describe('cleaning saved data', () => {
  it('drops junk, clears links to missing scenes and keeps a valid start', () => {
    const out = sanitizeStory({
      title: 'T', startId: 'gone',
      nodes: [
        { id: 'a', title: 'A', text: 'x', ending: false, x: 1, y: 2, choices: [{ id: 'c', label: 'L', reaction: '', to: 'missing' }, { nope: true }] },
        { id: 'b', ending: true, choices: [{ id: 'z', label: 'ignored', to: 'a' }] },
        { title: 'no id' },
      ],
    })!;
    expect(out.nodes).toHaveLength(2);
    expect(out.startId).toBe('a');
    expect(out.nodes[0].choices).toEqual([{ id: 'c', label: 'L', reaction: '', to: '' }]);
    expect(out.nodes[1].choices).toEqual([]);
    expect(sanitizeStory(null)).toBeNull();
  });
});

describe('the playable page', () => {
  it('renders text safely with paragraphs and emphasis', () => {
    expect(renderText('One *two* **three**\n\n<b>x</b>')).toBe('<p>One <em>two</em> <strong>three</strong></p><p>&lt;b&gt;x&lt;/b&gt;</p>');
  });

  it('keeps only choices that go somewhere, and no editor fields', () => {
    const s = starterStory();
    const open = addChoice(s, s.startId, newChoice('Nowhere'));
    const data = playData(open);
    expect(data.nodes[s.startId].choices.map(c => c.label)).toEqual(['Go this way', 'Go that way']);
    expect(JSON.stringify(data)).not.toContain('"x"');
  });

  it('cannot be broken out of by the writer’s text', () => {
    const s = starterStory('</script><script>alert(1)</script>');
    s.nodes[0].text = '</script><img src=x onerror=alert(1)>';
    const html = buildPlayableHtml(s);
    expect(html.match(/<script/g)!.length).toBe(2);
    expect(html).not.toContain('<img src=x');
    expect(embedJson({ a: '</script>' })).not.toContain('<');
    expect(html).toContain('<title>&lt;/script&gt;');
  });

  it('is one file with the player and the story inside', () => {
    const html = buildPlayableHtml(starterStory('Cave'));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('id="story"');
    expect(html).toContain('The beginning');
    expect(html).not.toMatch(/(src|href)="http/);
  });
});
