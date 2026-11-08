import type { Chapter, CharacterProfile, Project } from '../../types';
import type { OptionalScene, ProjectPlay } from './types';
import { expectsScenes, isClose, relationBetween } from '../relationships';
import { htmlToText, uid } from './rng';

// Missing Scene: looks at what the writer has written and set up, and points at moments that could be explored.
// it never says a gap is a mistake. a moment can be missing on purpose, and every suggestion can be set aside as intentional.

export type SuggestionKind = 'gap' | 'together' | 'secret' | 'offstage' | 'aftermath';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  // what was noticed, worded as a question, never as a fault
  text: string;
  characters: string[];
  // the chapter this would follow, or sit near
  afterChapterId?: string;
  reflections: string[];
}

export const KIND_LABEL: Record<SuggestionKind, string> = {
  gap: 'Time between chapters',
  together: 'Two people, alone',
  secret: 'Carrying a secret',
  offstage: 'Off the page',
  aftermath: 'After a reveal',
};

const REFLECTIONS: Record<SuggestionKind, string[]> = {
  gap: [
    'What is the first thing that changes in this stretch of time?',
    'What do the people involved know at the end that they did not at the start?',
    'If a stranger watched only this part, what would they think the story was about?',
  ],
  together: [
    'What do they say to each other when nobody else is there to hear it?',
    'What does each of them hold back that they would not hold back with someone else?',
    'What do we learn here that the group scenes could not show?',
  ],
  secret: [
    'How does the person carrying the secret behave differently around this one person?',
    'What nearly gives it away, and what covers it?',
    'What would be lost if it came out here?',
  ],
  offstage: [
    'Why does the story leave this out, and does the reader need to know?',
    'Who remembers this differently from how it is told?',
    'What would change if the reader had seen it happen?',
  ],
  aftermath: [
    'What does it feel like the next morning?',
    'Who knows, and who is pretending not to?',
    'What is the smallest, most ordinary thing that is different afterwards?',
  ],
};

const norm = (s: string) => s.trim().toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SCENE_BREAK = /<hr\b[^>]*>|<p[^>]*>\s*(?:[*✦✧⁂·•~–—-]\s*){3,}\s*<\/p>/gi;

export interface Section { id: string; chapterId: string; title: string; text: string; order: number }

// the stretches the story is told in: chapters, or the scenes of an open draft
export function sections(project: Pick<Project, 'chapters' | 'draftMode'>): Section[] {
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  if (project.draftMode === 'open_draft' && chapters.length === 1) {
    return chapters[0].content.split(SCENE_BREAK).map((html, i) => ({
      id: `${chapters[0].id}#${i}`, chapterId: chapters[0].id, title: `Scene ${i + 1}`, text: htmlToText(html), order: i,
    })).filter(s => s.text.length > 0);
  }
  return chapters.map((c, i) => ({ id: c.id, chapterId: c.id, title: c.title, text: htmlToText(c.content), order: i }));
}

// how a character is found in the text: their name, their aliases, and a first name that no one else shares
function matcherFor(c: CharacterProfile, all: readonly CharacterProfile[]): RegExp | null {
  const names = new Set<string>();
  const add = (n?: string) => { if (n && n.trim().length >= 2) names.add(n.trim()); };
  add(c.name);
  (c.aliases ?? []).forEach(add);
  const first = c.name.trim().split(/\s+/)[0];
  if (first && first.length >= 3 && all.filter(o => o.id !== c.id && norm(o.name).split(/\s+/)[0] === norm(first)).length === 0) add(first);
  if (!names.size) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...names].map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

const TIME_SKIP = /\b(?:(?:two|three|four|five|six|seven|eight|nine|ten|several|a few|a couple of|many|\d+)\s+(?:days|weeks|months|years)\s+(?:later|after|had passed|passed)|(?:the\s+)?(?:following|next)\s+(?:week|month|year)|(?:days|weeks|months|years)\s+later)\b/i;

const shortQuote = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s);

export function findSuggestions(project: Project): Suggestion[] {
  const secs = sections(project);
  const chars = project.storyBible.characters;
  const out: Suggestion[] = [];
  const nameOf = (id: string) => chars.find(c => c.id === id)?.name;
  const chapterTitle = (id: string) => project.chapters.find(c => c.id === id)?.title ?? 'the story';

  // 1. a chapter that opens by saying time has passed
  const ordered = [...project.chapters].sort((a, b) => a.order - b.order);
  ordered.forEach((ch, i) => {
    if (i === 0) return;
    const prev = ordered[i - 1];
    const opening = htmlToText(ch.content).slice(0, 700);
    const hit = TIME_SKIP.exec(opening);
    if (!hit) return;
    const inBoth = chars.filter(c => { const m = matcherFor(c, chars); return m && m.test(htmlToText(prev.content)) && m.test(opening); }).map(c => c.name);
    out.push({
      id: `gap:${prev.id}>${ch.id}`, kind: 'gap', afterChapterId: prev.id, characters: inBoth.slice(0, 4),
      title: `Between ${prev.title} and ${ch.title}`,
      text: `${ch.title} opens with "${hit[0]}". That stretch of time is not shown on the page. Is there something in it you want to see?`,
      reflections: REFLECTIONS.gap,
    });
  });

  // 2. a pair the cards say are close, who never share a scene without a crowd
  if (secs.length >= 2) {
    const present = chars.map(c => ({ c, m: matcherFor(c, chars) }));
    const mentions = secs.map(s => present.filter(p => p.m && p.m.test(s.text)).map(p => p.c.id));
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i];
        const b = chars[j];
        const rel = relationBetween(a, b);
        if (!rel.types.length || !(expectsScenes(rel.types) || isClose(rel.types))) continue;
        const withA = mentions.filter(m => m.includes(a.id)).length;
        const withB = mentions.filter(m => m.includes(b.id)).length;
        // both have to be in the story for their absence from each other to mean anything
        if (!withA || !withB) continue;
        const shared = mentions.filter(m => m.includes(a.id) && m.includes(b.id));
        const crowded = shared.length > 0 && shared.every(m => m.length >= 3);
        if (shared.length === 0 || crowded) {
          const last = secs.filter((_, k) => mentions[k].includes(a.id) || mentions[k].includes(b.id)).at(-1);
          out.push({
            id: `together:${[a.id, b.id].sort().join('+')}`, kind: 'together', afterChapterId: last?.chapterId, characters: [a.name, b.name],
            title: `${a.name} and ${b.name}, alone`,
            text: shared.length === 0
              ? `${a.name} and ${b.name} are connected in your notes, but have not been in the same part of the story yet. What happens when they are alone together?`
              : `${a.name} and ${b.name} have only been together in group settings so far. What happens when they are alone?`,
            reflections: REFLECTIONS.together,
          });
        }
      }
    }
  }

  // 3. someone who knows something that another character must not
  const secrets = project.storyBible.secrets ?? [];
  secrets.forEach(s => {
    s.knownBy.forEach(k => s.hiddenFrom.forEach(h => {
      const kn = nameOf(k);
      const hn = nameOf(h);
      if (!kn || !hn || k === h) return;
      out.push({
        id: `secret:${s.id}:${k}:${h}`, kind: 'secret', characters: [kn, hn],
        title: `${kn}, keeping "${shortQuote(s.text, 40)}" from ${hn}`,
        text: `${kn} knows something ${hn} must not. What is it like when the two of them are in a room together?`,
        reflections: REFLECTIONS.secret,
      });
    }));
  });
  chars.forEach(c => (c.secretHiddenFrom ?? []).forEach(h => {
    const hn = nameOf(h);
    if (!hn || h === c.id || !c.theSecret.trim()) return;
    out.push({
      id: `secret:card:${c.id}:${h}`, kind: 'secret', characters: [c.name, hn],
      title: `${c.name}, keeping a secret from ${hn}`,
      text: `${c.name}'s secret is kept from ${hn}. We may not have seen the two of them alone while it is still hidden. What is that like?`,
      reflections: REFLECTIONS.secret,
    });
  }));

  // 4. a timeline event the story never shows
  (project.timeline ?? []).forEach(e => {
    if (e.chapterId || e.quote?.trim()) return;
    const names = (e.characters ?? []).map(nameOf).filter((n): n is string => !!n);
    out.push({
      id: `offstage:${e.id}`, kind: 'offstage', characters: names.slice(0, 4),
      title: e.title,
      text: `"${e.title}" is on your timeline${e.when ? ` (${e.when})` : ''}, but the story does not show it${names.length ? ` with ${names.join(' and ')}` : ''}. Do you want to see it happen, or is it better left off the page?`,
      reflections: REFLECTIONS.offstage,
    });
  });

  // 5. a thread that pays off, and what comes after
  project.plotThreads.forEach(t => {
    const payoff = (t.passages ?? []).find(p => p.role === 'payoff');
    if (!payoff || t.status !== 'resolved' || (t.type !== 'secret' && t.type !== 'mystery')) return;
    out.push({
      id: `aftermath:${t.id}`, kind: 'aftermath', afterChapterId: payoff.chapterId, characters: [],
      title: `After "${t.title}"`,
      text: `"${t.title}" comes to light in ${chapterTitle(payoff.chapterId)}. We see the moment, but the quiet after it may not be there. Is there something in it worth writing?`,
      reflections: REFLECTIONS.aftermath,
    });
  });

  // a pair can come up from both sides of a card, and the same thing can be noticed twice
  const seen = new Set<string>();
  return out.filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

const ORDER: SuggestionKind[] = ['together', 'gap', 'secret', 'offstage', 'aftermath'];

// the suggestions the writer has not answered or set aside
export function openSuggestions(project: Project, limit = 12): Suggestion[] {
  const play: ProjectPlay = project.play ?? {};
  const closed = new Set([...(play.dismissed ?? []), ...(play.scenes ?? []).map(s => s.suggestionId).filter((x): x is string => !!x)]);
  return findSuggestions(project)
    .filter(s => !closed.has(s.id))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
    .slice(0, limit);
}

export function makeScene(s: Suggestion | null, title: string, html: string, reflections: OptionalScene['reflections'], now = new Date()): OptionalScene {
  return {
    id: uid('scene'),
    title: title.trim() || s?.title || 'Untitled scene',
    html,
    ...(s?.afterChapterId ? { chapterId: s.afterChapterId } : {}),
    ...(s ? { suggestionId: s.id, characters: s.characters } : {}),
    ...(reflections?.some(r => r.answer.trim()) ? { reflections: reflections.filter(r => r.answer.trim()) } : {}),
    createdAt: now.toISOString(),
  };
}

// puts a scene into the manuscript as its own chapter, straight after the chapter it follows (or at the end)
export function insertSceneAsChapter(chapters: readonly Chapter[], scene: OptionalScene, now = new Date()): Chapter[] {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const at = scene.chapterId ? sorted.findIndex(c => c.id === scene.chapterId) : -1;
  const index = at >= 0 ? at + 1 : sorted.length;
  const after = at >= 0 ? sorted[at] : sorted.at(-1);
  const chapter: Chapter = {
    id: uid('chap'), title: scene.title, order: 0, content: scene.html || '<p><br></p>', wordCount: 0, status: 'draft',
    ...(after?.folder ? { folder: after.folder } : {}), updatedAt: now.toISOString(),
  };
  const next = [...sorted.slice(0, index), chapter, ...sorted.slice(index)];
  return next.map((c, i) => ({ ...c, order: i + 1 }));
}
