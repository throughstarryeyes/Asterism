// an open draft is one flowing text; its scenes are the stretches between scene breaks
// these work on the draft's html, so scenes can be removed or reordered without chapters

export const SCENE_BREAK_HTML = '<hr style="border: none; border-top: 1px dashed var(--border-subtle); margin: 32px 0;" /><p style="text-align: center; color: var(--text-muted); font-style: italic; letter-spacing: 0.3em;">* * *</p>';

// what counts as a scene break: a rule, * * *, ---, ###, ___, ~~~ or . . .
// the ornament under a styled rule (see services/ornaments) counts as part of the break
export const SCENE_BREAK = /(?:<hr\b[^>]*>|<p\b[^>]*\bdata-separator-mark\b[^>]*>[^<]*<\/p>|<p\b[^>]*>(?:\s*<(?:em|i|strong|b|u|span)\b[^>]*>)*\s*(?:\*\s*\*\s*\*|---|#{1,3}|_{3,}|~{3,}|\.\s*\.\s*\.)\s*(?:<\/(?:em|i|strong|b|u|span)>\s*)*<\/p>|\n\s*(?:\*\s*\*\s*\*|---|#{1,3}|_{3,})\s*\n)/i;
const BREAK = SCENE_BREAK;

const BLANK = '<p><br></p>';

export function splitScenes(html: string): string[] {
  return (html || '').split(BREAK).filter(s => s && s.trim().length > 0);
}

export function joinScenes(scenes: string[]): string {
  return scenes.length ? scenes.join(SCENE_BREAK_HTML) : BLANK;
}

export function removeScene(html: string, index: number): string {
  const scenes = splitScenes(html);
  if (index < 0 || index >= scenes.length) return html;
  return joinScenes(scenes.filter((_, i) => i !== index));
}

export function moveScene(html: string, index: number, by: -1 | 1): string {
  const scenes = splitScenes(html);
  const to = index + by;
  if (index < 0 || to < 0 || index >= scenes.length || to >= scenes.length) return html;
  [scenes[index], scenes[to]] = [scenes[to], scenes[index]];
  return joinScenes(scenes);
}

// how many scenes the draft has (a draft with no breaks is one scene)
export const sceneCount = (html: string) => Math.max(1, splitScenes(html).length);
