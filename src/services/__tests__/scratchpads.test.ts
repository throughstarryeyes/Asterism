import { describe, expect, it } from 'vitest';
import { cleanNoteStyle, matchesSearch, newPad, noteCss, noteFile, parseNoteFile, putOnPage, shownOn, snippet, startSpot, whereLabel } from '../scratchpads';
import { keystrokeOptions } from '../../data/keystrokeSounds';
import { ownedKeystrokes } from '../shop';
import { parseThemeFile, themeFile } from '../shareTheme';
import { newCustomTheme } from '../customTheme';

const pad = (patch = {}) => ({ ...newPad('Ideas'), text: 'The lighthouse keeper hums', ...patch });

describe('where a note shows', () => {
  it('only shows while on the page, on its documents or everywhere', () => {
    expect(shownOn(pad({ docIds: ['d1'] }), 'd1')).toBe(false);
    expect(shownOn(pad({ floating: true, docIds: ['d1'] }), 'd1')).toBe(true);
    expect(shownOn(pad({ floating: true, docIds: ['d1'] }), 'd2')).toBe(false);
    expect(shownOn(pad({ floating: true, everywhere: true }), 'd2')).toBe(true);
  });
  it('puts a note on the page and ties it to the open document', () => {
    const on = putOnPage(pad(), 'd9', { width: 1000, height: 800 });
    expect(on.floating).toBe(true);
    expect(on.docIds).toEqual(['d9']);
    expect(on.x).toBe(40);
  });
  it('starts a pet in the bottom corner, and remembers where a moved note was left', () => {
    expect(startSpot({ kind: 'pet', w: 100, h: 100 }, { width: 1000, height: 800 })).toEqual({ x: 876, y: 676 });
    expect(putOnPage(pad({ x: 500, y: 300 }), 'd1').x).toBe(500);
  });
  it('names where a note lives', () => {
    const titles = { d1: 'Novel', d2: 'Poems' };
    expect(whereLabel(pad({ everywhere: true }), titles)).toBe('Every document');
    expect(whereLabel(pad({ docIds: ['d1'] }), titles)).toBe('Novel');
    expect(whereLabel(pad({ docIds: ['d1', 'd2'] }), titles)).toBe('2 documents');
    expect(whereLabel(pad({ docIds: ['gone'] }), titles)).toBe('No document yet');
  });
});

describe('searching', () => {
  it('finds by title or by what is written, ignoring case', () => {
    expect(matchesSearch(pad(), 'LIGHTHOUSE')).toBe(true);
    expect(matchesSearch(pad(), 'ideas')).toBe(true);
    expect(matchesSearch(pad(), 'dragon')).toBe(false);
    expect(matchesSearch(pad(), '  ')).toBe(true);
  });
  it('shows the words around a match', () => {
    expect(snippet(pad({ text: 'word '.repeat(60) + 'lighthouse' }), 'lighthouse')).toContain('lighthouse');
  });
});

describe('how a note looks', () => {
  it('drops anything that is not a real color, shape or border', () => {
    const s = cleanNoteStyle({ color: 'red; background:url(x)', shape: 'blob', border: 'laser', opacity: 0.01, borderWidth: 99, image: 'http://evil/x.png' });
    expect(s).toEqual({ shape: 'blob', opacity: 0.3, borderWidth: 8 });
  });
  it('keeps small pictures made by the app', () => {
    expect(cleanNoteStyle({ image: 'data:image/jpeg;base64,AAAA' }).image).toBe('data:image/jpeg;base64,AAAA');
  });
  it('turns dark colors into light text', () => {
    expect(noteCss({ color: '#2f2a3b' }).color).toBe('#f5f1e6');
    expect(noteCss({ color: '#fff3a8' }).color).toBe('#3a321a');
  });
  it('lets the writer see through a note', () => {
    expect(noteCss({ opacity: 0.5 }).opacity).toBe(0.5);
  });
});

describe('saving one note as a file', () => {
  it('keeps the words and look but leaves behind where it was and which documents', () => {
    const f = noteFile(pad({ floating: true, x: 5, docIds: ['d1'], everywhere: true, style: { color: '#ffd6e0', shape: 'pill' } }));
    const back = parseNoteFile(f.text);
    if ('error' in back) throw new Error(back.error);
    expect(back.text).toContain('lighthouse');
    expect(back.style).toEqual({ color: '#ffd6e0', shape: 'pill' });
    expect(back.docIds).toBeUndefined();
    expect(back.floating).toBeUndefined();
  });
  it('gives it a new id so it never replaces one the reader has', () => {
    const p = pad();
    const back = parseNoteFile(noteFile(p).text);
    expect('error' in back).toBe(false);
    expect((back as { id: string }).id).not.toBe(p.id);
  });
  it('refuses a file that is not one', () => {
    expect('error' in parseNoteFile('{"hello":1}')).toBe(true);
    expect('error' in parseNoteFile('nope')).toBe(true);
  });
});

describe('key sounds you have', () => {
  it('lists only the free ones to start, and what is picked stays visible', () => {
    const owned = ownedKeystrokes([], []);
    expect(owned).toEqual(expect.arrayContaining(['thocky', 'typewriter']));
    expect(owned).not.toContain('duck');
    const ids = keystrokeOptions([], owned, 'duck').map(o => o.id);
    expect(ids).toContain('duck');
    expect(ids).not.toContain('creamy');
    expect(ids).toContain('off');
  });
  it('adds a sound once it is bought', () => {
    expect(ownedKeystrokes(['keystroke-creamy'], [])).toContain('creamy');
  });
});

describe('sharing a theme', () => {
  it('round trips the colors and leaves pictures behind', () => {
    const t = newCustomTheme({ name: 'Dusk', bgApp: '#112233', appBgImageId: 'asset-1' });
    const back = parseThemeFile(themeFile(t).text);
    if ('error' in back) throw new Error(back.error);
    expect(back.bgApp).toBe('#112233');
    expect(back.name).toBe('Dusk');
    expect(back.appBgImageId).toBeUndefined();
    expect(back.id).not.toBe(t.id);
  });
  it('ignores colors that are not colors', () => {
    const text = JSON.stringify({ type: 'asterism-theme', theme: { name: 'x', bgApp: 'url(evil)' } });
    const back = parseThemeFile(text);
    if ('error' in back) throw new Error(back.error);
    expect(back.bgApp).toBe(newCustomTheme().bgApp);
  });
});
