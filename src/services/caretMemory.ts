// remembers where the caret last was in the writing, so a button elsewhere can insert there
let last: Range | null = null;

const rootOf = (node: Node | null): HTMLElement | null => {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest('.editable-manuscript[data-chapter-id]') as HTMLElement | null) ?? null;
};

export function trackCaret(): () => void {
  const onChange = () => {
    const sel = document.getSelection();
    if (sel && sel.rangeCount && rootOf(sel.anchorNode)) last = sel.getRangeAt(0).cloneRange();
  };
  document.addEventListener('selectionchange', onChange);
  return () => document.removeEventListener('selectionchange', onChange);
}

// put a divider at the caret, splitting the paragraph it is in. returns the chapter changed and its new html.
export function insertDividerAtCaret(dividerHtml: string): { chapterId: string; html: string } | null {
  if (!last || !last.startContainer.isConnected) return null;
  const root = rootOf(last.startContainer);
  const chapterId = root?.dataset.chapterId;
  if (!root || !chapterId) return null;

  let block: Node = last.startContainer;
  while (block.parentNode && block.parentNode !== root) block = block.parentNode;
  const holder = document.createElement('div');
  holder.innerHTML = dividerHtml;
  const nodes = Array.from(holder.childNodes);

  if (block.parentNode === root && block instanceof HTMLElement) {
    const tail = document.createRange();
    tail.setStart(last.startContainer, last.startOffset);
    tail.setEnd(block, block.childNodes.length);
    const rest = block.cloneNode(false) as HTMLElement;
    rest.appendChild(tail.extractContents());
    const hasRest = (rest.textContent ?? '').trim().length > 0;
    let after: Node = block;
    nodes.forEach(n => { after.parentNode!.insertBefore(n, after.nextSibling); after = n; });
    if (hasRest) after.parentNode!.insertBefore(rest, after.nextSibling);
    else if (!(block.textContent ?? '').trim()) block.remove();
  } else {
    nodes.forEach(n => root.appendChild(n));
  }
  last = null;
  return { chapterId, html: root.innerHTML };
}
