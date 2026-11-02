// the playable page: one HTML file with the story inside, that anyone can open and click through
import type { BranchingStory } from './branching';

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// plain writing to html: blank lines split paragraphs, **bold** and *italic* are kept
export function renderText(text: string): string {
  const inline = (s: string) => escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.split('\n').map(inline).join('<br>')}</p>`)
    .join('');
}

interface PlayChoice { label: string; reaction: string; to: string }
interface PlayNode { title: string; html: string; ending: boolean; choices: PlayChoice[] }
export interface PlayData { title: string; introHtml: string; start: string; nodes: Record<string, PlayNode> }

// only what a reader needs: no positions, no ids of unreachable scenes' notes
export function playData(story: BranchingStory): PlayData {
  const nodes: Record<string, PlayNode> = {};
  const ids = new Set(story.nodes.map(n => n.id));
  for (const n of story.nodes) {
    nodes[n.id] = {
      title: n.title,
      html: renderText(n.text),
      ending: n.ending,
      choices: n.choices
        .filter(c => c.label.trim() && ids.has(c.to))
        .map(c => ({ label: c.label.trim(), reaction: renderText(c.reaction), to: c.to })),
    };
  }
  return { title: story.title, introHtml: renderText(story.intro), start: story.startId, nodes };
}

// safe to place inside a script tag
export const embedJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const STYLE = `
:root{color-scheme:light dark;--bg:#f6f1e7;--paper:#fffdf8;--text:#2b2118;--muted:#6a5d4f;--accent:#7a3f1c;--line:#dccfb9;--hi:#f1e4cc}
@media (prefers-color-scheme:dark){:root{--bg:#15110d;--paper:#201a14;--text:#eee3d2;--muted:#b3a692;--accent:#e0a463;--line:#3a3025;--hi:#2d241b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:18px/1.7 Georgia,'Times New Roman',serif}
main{max-width:680px;margin:0 auto;padding:28px 18px 80px}
h1{font-size:1.9rem;line-height:1.25;margin:.2em 0 .4em}
h2{font-size:1.3rem;margin:0 0 .6em}
.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin:16px 0}
.reaction{background:var(--hi);border-left:4px solid var(--accent);border-radius:8px;padding:6px 18px;margin:16px 0;font-style:italic}
.choices{display:flex;flex-direction:column;gap:10px;margin-top:20px}
button{font:inherit;cursor:pointer}
.choice{text-align:left;padding:12px 16px;border-radius:10px;border:1px solid var(--accent);background:transparent;color:var(--text)}
.choice:hover{background:var(--hi)}
.primary{padding:11px 20px;border-radius:10px;border:0;background:var(--accent);color:var(--paper);font-weight:600}
.quiet{background:none;border:0;color:var(--muted);text-decoration:underline;padding:6px 2px;font-size:.9rem}
.bar{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:var(--muted);min-height:30px}
.end{text-align:center;color:var(--muted);letter-spacing:.2em;text-transform:uppercase;font-size:.8rem;margin-top:22px}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:no-preference){.card,.reaction{animation:in .25s ease-out}@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}
`;

// the page's own player; it reads the story from the json block above it
const PLAYER = `
(function () {
  var data = JSON.parse(document.getElementById('story').textContent);
  var root = document.getElementById('app');
  var history = [];
  var node = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function button(label, cls, fn) { var b = el('button', cls); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); return b; }
  function show(parts, focusTarget) {
    root.innerHTML = '';
    parts.forEach(function (p) { root.appendChild(p); });
    window.scrollTo(0, 0);
    if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
  }
  function bar(withBack) {
    var b = el('div', 'bar');
    var left = el('span');
    if (withBack && history.length) left.appendChild(button('Go back', 'quiet', back));
    b.appendChild(left);
    if (history.length || node) b.appendChild(button('Start over', 'quiet', start));
    return b;
  }
  function start() { history = []; node = null; intro(); }
  function intro() {
    var card = el('div', 'card');
    var h = el('h1'); h.textContent = data.title;
    card.appendChild(h);
    if (data.introHtml) card.appendChild(el('div', '', data.introHtml));
    card.appendChild(button('Begin', 'primary', function () { visit(data.start); }));
    show([card], h);
  }
  // moving on from a scene adds it to the trail, so "Go back" can return to it
  function visit(id) {
    var n = data.nodes[id];
    if (!n) { intro(); return; }
    if (node !== null) history.push(node);
    node = id;
    var card = el('div', 'card');
    var h = el('h2'); h.textContent = n.title;
    card.appendChild(h);
    card.appendChild(el('div', '', n.html));
    var parts = [bar(true), card];
    if (n.ending) {
      parts.push(el('div', 'end', 'The end'));
      var again = el('div', 'choices');
      again.appendChild(button('Start over', 'primary', start));
      parts.push(again);
    } else {
      var list = el('div', 'choices');
      list.setAttribute('role', 'group');
      list.setAttribute('aria-label', 'What do you do?');
      n.choices.forEach(function (c) { list.appendChild(button(c.label, 'choice', function () { choose(c); })); });
      parts.push(list);
    }
    show(parts, h);
  }
  // the reaction to a pick comes first, then the next scene
  function choose(c) {
    if (!c.reaction) { visit(c.to); return; }
    var from = node;
    var r = el('div', 'reaction', c.reaction);
    var next = el('div', 'choices');
    var go = button('Continue', 'primary', function () { visit(c.to); });
    next.appendChild(go);
    next.appendChild(button('Choose differently', 'quiet', function () { node = null; visit(from); }));
    show([bar(false), r, next], r);
    go.focus({ preventScroll: true });
  }
  function back() {
    var prev = history.pop();
    node = null;
    if (prev == null) { intro(); return; }
    visit(prev);
  }
  intro();
})();
`;

export function buildPlayableHtml(story: BranchingStory): string {
  const data = playData(story);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(story.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main id="app" aria-live="polite"><p>Loading…</p></main>
<noscript><main><p>This story needs JavaScript to be played.</p></main></noscript>
<script type="application/json" id="story">${embedJson(data)}</script>
<script>${PLAYER}</script>
</body>
</html>
`;
}
