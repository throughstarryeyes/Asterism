import { describe, it, expect } from 'vitest';
import { SCENE_BREAK_HTML, joinScenes, moveScene, removeScene, sceneCount, splitScenes } from '../openDraft';

const a = '<p>The first scene.</p>';
const b = '<p>The second scene.</p>';
const c = '<p>The third scene.</p>';

describe('scenes in an open draft', () => {
  it('splits at the breaks the app inserts, and at plain ones', () => {
    expect(splitScenes(`${a}${SCENE_BREAK_HTML}${b}`)).toEqual([a, b]);
    expect(splitScenes(`${a}<p>* * *</p>${b}<hr>${c}`)).toEqual([a, b, c]);
    expect(splitScenes(a)).toEqual([a]);
    expect(splitScenes('')).toEqual([]);
  });

  it('counts a draft with no breaks as one scene', () => {
    expect(sceneCount(a)).toBe(1);
    expect(sceneCount('')).toBe(1);
    expect(sceneCount(`${a}${SCENE_BREAK_HTML}${b}${SCENE_BREAK_HTML}${c}`)).toBe(3);
  });

  it('removes one scene and keeps the others in order', () => {
    const draft = joinScenes([a, b, c]);
    expect(splitScenes(removeScene(draft, 1))).toEqual([a, c]);
    expect(splitScenes(removeScene(draft, 0))).toEqual([b, c]);
    expect(splitScenes(removeScene(draft, 2))).toEqual([a, b]);
  });

  it('leaves a blank page, not nothing, when the last scene goes', () => {
    expect(removeScene(a, 0)).toBe('<p><br></p>');
  });

  it('ignores a scene that is not there', () => {
    const draft = joinScenes([a, b]);
    expect(removeScene(draft, 5)).toBe(draft);
    expect(removeScene(draft, -1)).toBe(draft);
  });

  it('moves a scene up or down, and stops at the ends', () => {
    const draft = joinScenes([a, b, c]);
    expect(splitScenes(moveScene(draft, 1, -1))).toEqual([b, a, c]);
    expect(splitScenes(moveScene(draft, 1, 1))).toEqual([a, c, b]);
    expect(moveScene(draft, 0, -1)).toBe(draft);
    expect(moveScene(draft, 2, 1)).toBe(draft);
  });
});
