import { describe, it, expect } from 'vitest';
import { locatePassage, prepareChapters, reanchorThreads } from '../passageAnchor';
import { linkPassage, relinkPassage, threadFromLoop } from '../threads';
import type { OpenLoop } from '../openLoops';
import type { PlotThread } from '../../types';

const p = (text: string) => `<p>${text}</p>`;
const chapters = (...html: string[]) => prepareChapters(html.map((content, i) => ({ id: `c${i}`, content })));

const QUOTE = 'Dana finally learned who sent the letter, and the whole room went quiet.';
const intro = 'Rain hammered the roof all night long. ';

const baseThread = (patch: Partial<PlotThread> = {}): PlotThread => ({
  ...threadFromLoop({ id: 'board-q-0-x', kind: 'question', sentence: 'Who sent this letter?', chapterId: 'c0' } as OpenLoop),
  passageQuote: '',
  ...patch
});

describe('finding a passage again', () => {
  it('finds the same words where they were, and keeps the text around them', () => {
    const found = locatePassage({ chapterId: 'c1', quote: QUOTE }, chapters(p('Nothing here.'), p(intro + QUOTE + ' Then Mara stood up.')));
    expect(found).toMatchObject({ chapterId: 'c1', text: QUOTE, how: 'exact', moved: false });
    expect(found!.before).toContain('all night long');
    expect(found!.after).toContain('Mara stood up');
  });

  it('ignores curly quotes, spacing and a trailing ellipsis', () => {
    const page = chapters(p('“Who sent   this letter?” Dana asked the empty room again.'));
    expect(locatePassage({ chapterId: 'c0', quote: '"Who sent this letter?" Dana asked the empty room…' }, page)?.how).toBe('exact');
  });

  it('follows a scene that moved to another chapter', () => {
    const found = locatePassage({ chapterId: 'c0', quote: QUOTE }, chapters(p('Cut.'), p(QUOTE)));
    expect(found).toMatchObject({ chapterId: 'c1', how: 'exact', moved: true });
  });

  it('follows a sentence that was reworded', () => {
    const edited = 'Dana at last learned who had sent the letter, and the whole room went quiet.';
    const found = locatePassage({ chapterId: 'c0', quote: QUOTE }, chapters(p(intro + edited + ' Mara stood.')));
    expect(found).toMatchObject({ chapterId: 'c0', text: edited, how: 'edited' });
  });

  it('gives up when nothing close is left', () => {
    expect(locatePassage({ chapterId: 'c0', quote: QUOTE }, chapters(p(intro + 'The harbor was empty by morning and the gulls had gone.')))).toBeNull();
  });

  it('uses the surrounding text to choose between a line that appears twice', () => {
    const line = 'The door was locked from the inside.';
    const page = chapters(p('The kitchen was cold. ' + line + ' Nobody answered.'), p('A shout came down the hall. ' + line + ' Dana ran.'));
    const found = locatePassage({ chapterId: 'c9', quote: line, before: 'A shout came down the hall.', after: 'Dana ran.' }, page);
    expect(found?.chapterId).toBe('c1');
  });

  it('keeps a duplicate in the chapter it was linked in', () => {
    const page = chapters(p(QUOTE), p(QUOTE));
    expect(locatePassage({ chapterId: 'c1', quote: QUOTE }, page)?.chapterId).toBe('c1');
  });

  it('does not chase a short quote into other chapters', () => {
    expect(locatePassage({ chapterId: 'c0', quote: 'He left.' }, chapters(p('Nothing.'), p('He left.')))).toBeNull();
  });
});

describe('keeping a thread in step with the manuscript', () => {
  const linked = () => linkPassage(baseThread(), { chapterId: 'c0', quote: QUOTE, role: 'payoff' });

  it('changes nothing, and returns the same array, when every passage is still there', () => {
    const page = chapters(p(intro + QUOTE));
    const first = reanchorThreads([linked()], page);
    expect(reanchorThreads(first, page)).toBe(first);
  });

  it('updates the link to follow an edit, and settles after one pass', () => {
    const edited = 'Dana at last learned who had sent the letter, and the whole room went quiet.';
    const page = chapters(p(intro + edited));
    const [thread] = reanchorThreads([linked()], page);
    expect(thread.passages![0]).toMatchObject({ quote: edited });
    expect(thread.passages![0].lost).toBeUndefined();
    const again = reanchorThreads([thread], page);
    expect(again[0]).toBe(thread);
  });

  it('follows a moved passage to its new chapter', () => {
    const [thread] = reanchorThreads([linked()], chapters(p('Cut.'), p(QUOTE)));
    expect(thread.passages![0].chapterId).toBe('c1');
  });

  it('flags a deleted passage as lost, keeps its words, and recovers it if the text returns', () => {
    const [lost] = reanchorThreads([linked()], chapters(p('The harbor was empty by morning and the gulls had gone.')));
    expect(lost.passages![0]).toMatchObject({ lost: true, quote: QUOTE });
    const [back] = reanchorThreads([lost], chapters(p(QUOTE)));
    expect(back.passages![0].lost).toBeUndefined();
  });

  it('tracks where the thread was raised, too', () => {
    const raised = baseThread({ passageQuote: 'Who sent this letter?', introducedInChapterId: 'c0' });
    const [moved] = reanchorThreads([raised], chapters(p('Cut.'), p('Before. Who sent this letter? After.')));
    expect(moved.introducedInChapterId).toBe('c1');
    const [gone] = reanchorThreads([raised], chapters(p('Something else entirely happens in this chapter now.')));
    expect(gone.originLost).toBe(true);
  });

  it('does nothing while the manuscript has no text, so a slow load cannot mark everything lost', () => {
    const threads = [linked()];
    expect(reanchorThreads(threads, chapters(''))).toBe(threads);
  });

  it('lets the writer point a lost link at new words', () => {
    const [lost] = reanchorThreads([linked()], chapters(p('The harbor was empty by morning and the gulls had gone.')));
    const fixed = relinkPassage(lost, lost.passages![0].id, 'c0', 'The harbor was empty by morning');
    expect(fixed.passages![0]).toMatchObject({ quote: 'The harbor was empty by morning', role: 'payoff' });
    expect(fixed.passages![0].lost).toBeUndefined();
  });
});
