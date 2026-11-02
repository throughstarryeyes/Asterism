import type { Editor } from '@tiptap/core';

// the editor's html, in the shape the rest of the app expects. the editor wraps the text of a list item in a paragraph;
// the old editor (and the exporters) write it bare, so it is unwrapped on the way out.
export function tidyHtml(html: string): string {
  if (!html.includes('<li')) return html;
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('li > p:first-child').forEach(p => {
    if (p.attributes.length > 0) return;
    p.replaceWith(...Array.from(p.childNodes));
  });
  return root.innerHTML;
}

export const editorHtml = (editor: Editor): string => tidyHtml(editor.getHTML());
