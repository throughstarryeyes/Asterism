// a branching story: scenes the reader moves through by picking a choice
// pure helpers only; the screens and the playable export use them

export interface BranchChoice {
  id: string;
  label: string;
  // shown right after the pick, before the next scene
  reaction: string;
  // the scene it leads to; empty until the writer connects it
  to: string;
}

export interface BranchNode {
  id: string;
  title: string;
  text: string;
  // an ending closes the story; it has no choices
  ending: boolean;
  choices: BranchChoice[];
  x: number;
  y: number;
}

export interface BranchingStory {
  title: string;
  intro: string;
  startId: string;
  nodes: BranchNode[];
}

export const MAX_NODES = 150;
export const MAX_CHOICES = 6;
export const NODE_W = 190;
export const NODE_H = 78;

let counter = 0;
export const newBranchId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function newNode(title: string, x: number, y: number, ending = false): BranchNode {
  return { id: newBranchId('scene'), title, text: '', ending, choices: [], x, y };
}

export function newChoice(label = ''): BranchChoice {
  return { id: newBranchId('choice'), label, reaction: '', to: '' };
}

// a small story to start from, so the screen is never blank
export function starterStory(title = 'My branching story'): BranchingStory {
  const start = newNode('The beginning', 40, 160);
  start.text = 'Describe where the reader is and what is happening.';
  const a = newNode('One way', 320, 60);
  const b = newNode('Another way', 320, 260);
  const end = newNode('The end', 600, 160, true);
  start.choices = [{ ...newChoice('Go this way'), reaction: 'You decide quickly.', to: a.id }, { ...newChoice('Go that way'), reaction: 'You hesitate, then go.', to: b.id }];
  a.choices = [{ ...newChoice('Continue'), to: end.id }];
  b.choices = [{ ...newChoice('Continue'), to: end.id }];
  return { title, intro: '', startId: start.id, nodes: [start, a, b, end] };
}

export const nodeById = (story: BranchingStory, id: string) => story.nodes.find(n => n.id === id);

export function addNode(story: BranchingStory, node: BranchNode): BranchingStory {
  if (story.nodes.length >= MAX_NODES) return story;
  return { ...story, nodes: [...story.nodes, node], startId: story.startId || node.id };
}

export function updateNode(story: BranchingStory, id: string, change: Partial<BranchNode>): BranchingStory {
  return {
    ...story,
    nodes: story.nodes.map(n => {
      if (n.id !== id) return n;
      const next = { ...n, ...change };
      // an ending has nothing to choose from
      return next.ending ? { ...next, choices: [] } : next;
    }),
  };
}

// removing a scene also clears every choice that led to it
export function removeNode(story: BranchingStory, id: string): BranchingStory {
  const nodes = story.nodes.filter(n => n.id !== id).map(n => ({ ...n, choices: n.choices.map(c => (c.to === id ? { ...c, to: '' } : c)) }));
  const startId = story.startId === id ? (nodes[0]?.id ?? '') : story.startId;
  return { ...story, nodes, startId };
}

export function addChoice(story: BranchingStory, nodeId: string, choice = newChoice()): BranchingStory {
  const node = nodeById(story, nodeId);
  if (!node || node.ending || node.choices.length >= MAX_CHOICES) return story;
  return updateNode(story, nodeId, { choices: [...node.choices, choice] });
}

export function updateChoice(story: BranchingStory, nodeId: string, choiceId: string, change: Partial<BranchChoice>): BranchingStory {
  const node = nodeById(story, nodeId);
  if (!node) return story;
  return updateNode(story, nodeId, { choices: node.choices.map(c => (c.id === choiceId ? { ...c, ...change } : c)) });
}

export function removeChoice(story: BranchingStory, nodeId: string, choiceId: string): BranchingStory {
  const node = nodeById(story, nodeId);
  return node ? updateNode(story, nodeId, { choices: node.choices.filter(c => c.id !== choiceId) }) : story;
}

// a new scene made from a choice, placed to the right of where it came from, and connected
export function branchOut(story: BranchingStory, fromId: string, choiceId: string, title = 'New scene'): { story: BranchingStory; id: string } {
  const from = nodeById(story, fromId);
  if (!from || story.nodes.length >= MAX_NODES) return { story, id: '' };
  const siblings = story.nodes.filter(n => Math.abs(n.x - (from.x + 270)) < 40).length;
  const node = newNode(title, from.x + 270, from.y + siblings * (NODE_H + 30));
  const added = addNode(story, node);
  return { story: updateChoice(added, fromId, choiceId, { to: node.id }), id: node.id };
}

// scenes the reader can get to from the start
export function reachable(story: BranchingStory): Set<string> {
  const seen = new Set<string>();
  const queue = story.startId ? [story.startId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    const node = nodeById(story, id);
    if (!node) continue;
    seen.add(id);
    node.choices.forEach(c => { if (c.to) queue.push(c.to); });
  }
  return seen;
}

export type BranchProblemKind = 'no-start' | 'unreachable' | 'dead-end' | 'open-choice' | 'empty-choice' | 'no-ending';
export interface BranchProblem { kind: BranchProblemKind; nodeId?: string; message: string }

// what would trip a reader up
export function checkStory(story: BranchingStory): BranchProblem[] {
  const problems: BranchProblem[] = [];
  if (!nodeById(story, story.startId)) {
    problems.push({ kind: 'no-start', message: 'Pick a scene to start from.' });
    return problems;
  }
  const seen = reachable(story);
  for (const n of story.nodes) {
    if (!seen.has(n.id)) problems.push({ kind: 'unreachable', nodeId: n.id, message: `“${n.title}” can’t be reached.` });
    if (!n.ending && n.choices.length === 0) problems.push({ kind: 'dead-end', nodeId: n.id, message: `“${n.title}” has no choices and isn’t an ending.` });
    for (const c of n.choices) {
      if (!c.label.trim()) problems.push({ kind: 'empty-choice', nodeId: n.id, message: `A choice in “${n.title}” has no words.` });
      else if (!c.to || !nodeById(story, c.to)) problems.push({ kind: 'open-choice', nodeId: n.id, message: `“${c.label}” in “${n.title}” doesn’t lead anywhere.` });
    }
  }
  if (!story.nodes.some(n => n.ending && seen.has(n.id))) problems.push({ kind: 'no-ending', message: 'No ending can be reached yet.' });
  return problems;
}

export interface BranchStats { scenes: number; endings: number; choices: number; paths: number }

// how many different ways through, from the start to an ending
// a choice that loops back to a scene already on the way is not counted
export function storyStats(story: BranchingStory): BranchStats {
  const memo = new Map<string, number>();
  const onPath = new Set<string>();
  const count = (id: string): number => {
    const node = nodeById(story, id);
    if (!node || onPath.has(id)) return 0;
    if (node.ending) return 1;
    const known = memo.get(id);
    if (known !== undefined) return known;
    onPath.add(id);
    const total = Math.min(node.choices.reduce((sum, c) => sum + (c.to ? count(c.to) : 0), 0), 1_000_000);
    onPath.delete(id);
    memo.set(id, total);
    return total;
  };
  return {
    scenes: story.nodes.length,
    endings: story.nodes.filter(n => n.ending).length,
    choices: story.nodes.reduce((sum, n) => sum + n.choices.length, 0),
    paths: count(story.startId),
  };
}

// scenes in the order a reader would meet them: breadth first from the start, then any strays
export function readingOrder(story: BranchingStory): BranchNode[] {
  const order: BranchNode[] = [];
  const seen = new Set<string>();
  const visit = (rootId: string) => {
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      const node = nodeById(story, id);
      if (!node || seen.has(id)) continue;
      seen.add(id);
      order.push(node);
      node.choices.forEach(c => { if (c.to) queue.push(c.to); });
    }
  };
  visit(story.startId);
  story.nodes.forEach(n => visit(n.id));
  return order;
}

// tidy positions: columns by how far a scene is from the start, rows stacked in each column
export function autoArrange(story: BranchingStory): BranchingStory {
  const depth = new Map<string, number>();
  const queue = story.startId ? [story.startId] : [];
  depth.set(story.startId, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const node = nodeById(story, id);
    if (!node) continue;
    for (const c of node.choices) {
      if (c.to && !depth.has(c.to)) { depth.set(c.to, depth.get(id)! + 1); queue.push(c.to); }
    }
  }
  const strays = Math.max(-1, ...depth.values()) + 1;
  const rows = new Map<number, number>();
  const nodes = readingOrder(story).map(n => {
    const col = depth.get(n.id) ?? strays;
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    return { ...n, x: 40 + col * (NODE_W + 80), y: 40 + row * (NODE_H + 36) };
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  return { ...story, nodes: story.nodes.map(n => byId.get(n.id) ?? n) };
}

// keeps whatever was saved safe to open: unknown fields dropped, links to missing scenes cleared
export function sanitizeStory(raw: unknown): BranchingStory | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-5000, Math.min(20000, v)) : fallback);
  const list = Array.isArray(r.nodes) ? r.nodes.slice(0, MAX_NODES) : [];
  const nodes: BranchNode[] = [];
  list.forEach((n, i) => {
    const x = n as Record<string, unknown> | null;
    if (!x || typeof x.id !== 'string' || !x.id) return;
    const ending = x.ending === true;
    nodes.push({
      id: x.id, title: str(x.title, 80) || 'Untitled scene', text: str(x.text, 20000), ending,
      x: num(x.x, 40 + i * 30), y: num(x.y, 40 + i * 30),
      choices: ending ? [] : (Array.isArray(x.choices) ? x.choices : []).slice(0, MAX_CHOICES).flatMap(c => {
        const y = c as Record<string, unknown> | null;
        return y && typeof y.id === 'string' ? [{ id: y.id, label: str(y.label, 200), reaction: str(y.reaction, 2000), to: str(y.to, 100) }] : [];
      }),
    });
  });
  const ids = new Set(nodes.map(n => n.id));
  nodes.forEach(n => n.choices.forEach(c => { if (!ids.has(c.to)) c.to = ''; }));
  const startId = typeof r.startId === 'string' && ids.has(r.startId) ? r.startId : (nodes[0]?.id ?? '');
  return { title: str(r.title, 120) || 'My branching story', intro: str(r.intro, 5000), startId, nodes };
}
