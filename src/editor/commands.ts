import type { Editor } from '@tiptap/core';

// what the toolbar asks of the editor. the names follow the browser's old editing commands so the toolbar reads the same either way.

export type Align = 'left' | 'center' | 'right' | 'justify';
const ALIGNABLE = new Set(['paragraph', 'heading']);

// the css in a block's style attribute, as a list we can change one property of
function withStyle(style: string | null | undefined, prop: string, value: string | null): string | null {
  const kept = (style ?? '').split(';').map(s => s.trim()).filter(s => s && !s.toLowerCase().startsWith(`${prop}:`));
  if (value) kept.push(`${prop}: ${value}`);
  return kept.length ? kept.join('; ') + ';' : null;
}

const alignOf = (style: string | null | undefined): Align => {
  const m = /text-align:\s*(left|center|right|justify)/i.exec(style ?? '');
  return (m?.[1].toLowerCase() as Align | undefined) ?? 'left';
};

export function setAlign(editor: Editor, align: Align) {
  const { from, to } = editor.state.selection;
  editor.chain().focus().command(({ tr, state }) => {
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!ALIGNABLE.has(node.type.name)) return;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: withStyle(node.attrs.style as string | null, 'text-align', align === 'left' ? null : align) });
    });
    return true;
  }).run();
}

export function blockAlign(editor: Editor): Align {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (ALIGNABLE.has(node.type.name)) return alignOf(node.attrs.style as string | null);
  }
  return 'left';
}

// the formats the cursor is in, for the toolbar's pressed buttons
export function formatState(editor: Editor): Record<string, boolean> {
  const align = blockAlign(editor);
  return {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'), strike: editor.isActive('strike'),
    ul: editor.isActive('bulletList'), ol: editor.isActive('orderedList'),
    left: align === 'left', center: align === 'center', right: align === 'right', full: align === 'justify',
    h2: editor.isActive('heading', { level: 2 }), h3: editor.isActive('heading', { level: 3 }), quote: editor.isActive('blockquote'),
  };
}

// the size, in pixels, of the text at the start of the selection
export function sizeAt(editor: Editor): number | null {
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const el = node instanceof Element ? node : node.parentElement;
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
  } catch { return null; }
}

export function setSize(editor: Editor, px: number) {
  editor.chain().focus().setFontSize(`${px}px`).run();
}

// quote the name: unquoted, a family like "Name 2023" is invalid css and the browser drops it
export function setFont(editor: Editor, family: string) {
  editor.chain().focus().setFontFamily(`"${family.replace(/["\\]/g, '\\$&')}"`).run();
}

export function setTextColor(editor: Editor, color: string | null) {
  const chain = editor.chain().focus();
  if (color) chain.setColor(color).run(); else chain.unsetColor().run();
}

export function setHighlight(editor: Editor, color: string | null) {
  const chain = editor.chain().focus();
  if (color) chain.setBackgroundColor(color).run(); else chain.unsetBackgroundColor().run();
}

// the browser-style command names the toolbar uses
export function run(editor: Editor, command: string, value?: string) {
  const c = editor.chain().focus();
  switch (command) {
    case 'bold': return void c.toggleBold().run();
    case 'italic': return void c.toggleItalic().run();
    case 'underline': return void c.toggleUnderline().run();
    case 'strikeThrough': return void c.toggleStrike().run();
    case 'insertUnorderedList': return void c.toggleBulletList().run();
    case 'insertOrderedList': return void c.toggleOrderedList().run();
    case 'justifyLeft': return setAlign(editor, 'left');
    case 'justifyCenter': return setAlign(editor, 'center');
    case 'justifyRight': return setAlign(editor, 'right');
    case 'justifyFull': return setAlign(editor, 'justify');
    case 'undo': return void c.undo().run();
    case 'redo': return void c.redo().run();
    case 'formatBlock':
      if (value === '<h2>') return void c.toggleHeading({ level: 2 }).run();
      if (value === '<h3>') return void c.toggleHeading({ level: 3 }).run();
      if (value === '<blockquote>') return void c.toggleBlockquote().run();
      return void c.setParagraph().run();
    default: return;
  }
}

// a scene break (rule and ornament) at the cursor, followed by an empty paragraph to carry on in
export function insertHtml(editor: Editor, html: string) {
  editor.chain().focus().insertContent(html).run();
}
