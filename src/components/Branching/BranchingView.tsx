import React, { useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { DialogFrame } from '../Common/DialogFrame';
import { useNarrow } from '../Common/useNarrow';
import { ToolDocBar } from '../Common/ToolDocBar';
import { BranchMap } from './BranchMap';
import { SceneEditor } from './SceneEditor';
import { storageService } from '../../services/storage';
import { buildPlayableHtml } from '../../services/branchingExport';
import {
  MAX_NODES, addChoice, addNode, autoArrange, branchOut, checkStory, newChoice, newNode, nodeById, readingOrder,
  removeChoice, removeNode, starterStory, storyStats, updateChoice, updateNode, type BranchingStory,
} from '../../services/branching';
import { AlertTriangle, ArrowLeft, Download, Flag, GitBranch, LayoutGrid, List, Map as MapIcon, Play, Plus, X } from 'lucide-react';

const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' };

const stem = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'story';

// build an interactive story: a map of scenes and choices the reader can click through
export const BranchingView: React.FC = () => {
  const { toolDoc, updateToolDoc, leaveTool, toolFromDoc, showToast, noteExport } = useAsterism();
  const narrow = useNarrow();
  const story = toolDoc.branching ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [playing, setPlaying] = useState(false);

  const save = (next: BranchingStory) => updateToolDoc({ branching: next });
  const problems = useMemo(() => (story ? checkStory(story) : []), [story]);
  const flagged = useMemo(() => new Set(problems.flatMap(p => (p.nodeId ? [p.nodeId] : []))), [problems]);
  const stats = useMemo(() => (story ? storyStats(story) : null), [story]);
  const selected = story && selectedId ? nodeById(story, selectedId) : undefined;

  const header = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--toolbar-bg)' }}>
      <button onClick={leaveTool} style={pill}><ArrowLeft size={14} /> <span>{toolFromDoc ? 'Back to writing' : 'Home'}</span></button>
      <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
        <GitBranch size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} /> Branching story
      </h1>
      <ToolDocBar kind="branching" />
      {story && stats && (
        <>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {stats.scenes} scene{stats.scenes === 1 ? '' : 's'} · {stats.endings} ending{stats.endings === 1 ? '' : 's'} · {stats.paths >= 1_000_000 ? '1,000,000+' : stats.paths} way{stats.paths === 1 ? '' : 's'} through
          </span>
          <span style={{ flex: 1 }} />
          <div role="group" aria-label="View" style={{ display: 'flex', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {([['map', 'Map', <MapIcon key="m" size={14} />], ['list', 'List', <List key="l" size={14} />]] as const).map(([id, name, icon]) => (
              <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} style={{ ...pill, border: 'none', borderRadius: 0, backgroundColor: mode === id ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: mode === id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)', fontWeight: mode === id ? 600 : 500 }}>{icon}{name}</button>
            ))}
          </div>
          <button onClick={() => { const n = newNode('New scene', 60, 60); save(addNode(story, { ...n, x: 60 + (story.nodes.length % 5) * 30, y: 60 + (story.nodes.length % 5) * 30 })); setSelectedId(n.id); }} disabled={story.nodes.length >= MAX_NODES} style={pill}><Plus size={14} /> Add scene</button>
          <button onClick={() => save(autoArrange(story))} style={pill} title="Tidy the map into columns"><LayoutGrid size={14} /> Arrange</button>
          <button onClick={() => setPlaying(true)} style={{ ...pill, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600 }}><Play size={14} /> Play it</button>
          <button
            onClick={() => {
              storageService.downloadTextFile(`${stem(story.title)}.html`, buildPlayableHtml(story), 'text/html');
              // a story with a way through it and an ending is worth the points; an empty map is not
              if (storyStats(story).endings > 0 && story.nodes.length >= 3) noteExport('branching', toolDoc.id);
              showToast(problems.length ? `Saved the page. ${problems.length} thing${problems.length === 1 ? '' : 's'} to check first.` : 'Saved. Send that file to anyone and they can play it.', problems.length ? 'info' : 'success');
            }}
            style={pill}
            title="One web page anyone can open and click through"
          ><Download size={14} /> Save as a page</button>
        </>
      )}
    </header>
  );

  if (!story) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', backgroundColor: 'var(--bg-app)' }}>
        {header}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <GitBranch size={40} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
            <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>A story the reader steers</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Write scenes, give each a few choices, and decide how the world reacts. See every path on a map. When it’s ready, save it as one web page that anyone can click through.
            </p>
            <button onClick={() => { save(starterStory(toolDoc.title)); setSelectedId(null); }} style={{ ...pill, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600, padding: '10px 20px' }}>Start a branching story</button>
          </div>
        </main>
      </div>
    );
  }

  const panel = (
    <aside aria-label={selected ? 'Edit scene' : 'About this story'} style={{ width: narrow ? '100%' : 380, flexShrink: 0, flex: narrow ? '1 1 0' : undefined, minHeight: 0, overflowY: 'auto', padding: 16, borderLeft: narrow ? 'none' : '1px solid var(--border-subtle)', borderTop: narrow ? '1px solid var(--border-subtle)' : 'none', backgroundColor: 'var(--bg-sidebar)' }}>
      {selected ? (
        <>
          <button onClick={() => setSelectedId(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={13} /> Close this scene</button>
          <SceneEditor
            key={selected.id}
            story={story}
            node={selected}
            onChange={change => save(updateNode(story, selected.id, change))}
            onAddChoice={() => save(addChoice(story, selected.id, newChoice('')))}
            onChoice={(cid, change) => save(updateChoice(story, selected.id, cid, change))}
            onRemoveChoice={cid => save(removeChoice(story, selected.id, cid))}
            onBranchOut={cid => { const out = branchOut(story, selected.id, cid); save(out.story); if (out.id) setSelectedId(out.id); }}
            onMakeStart={() => save({ ...story, startId: selected.id })}
            onRemove={() => { save(removeNode(story, selected.id)); setSelectedId(null); }}
            onGo={setSelectedId}
          />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="story-title" style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Story title</label>
          <input id="story-title" value={story.title} maxLength={120} onChange={e => save({ ...story, title: e.target.value })} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }} />
          <label htmlFor="story-intro" style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: 10 }}>Opening note (shown before the first scene)</label>
          <textarea id="story-intro" value={story.intro} rows={4} onChange={e => save({ ...story, intro: e.target.value })} placeholder="Optional. Set the mood or explain how to play." style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', resize: 'vertical', fontFamily: 'var(--font-body)' }} />
          <h2 style={{ margin: '18px 0 6px', fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {problems.length ? <AlertTriangle size={15} style={{ color: '#d97706' }} /> : null} Checks
          </h2>
          {problems.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Every scene can be reached and every path ends. Ready to share.</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {problems.map((p, i) => (
                <li key={i}>
                  {p.nodeId
                    ? <button onClick={() => setSelectedId(p.nodeId!)} style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-main)', textDecoration: 'underline', cursor: 'pointer' }}>{p.message}</button>
                    : <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{p.message}</span>}
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: '18px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Click a scene to edit it. Drag scenes to move them. Drag the background to pan, and scroll to zoom.</p>
        </div>
      )}
    </aside>
  );

  const list = (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, backgroundColor: 'var(--bg-app)' }}>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
        {readingOrder(story).map(n => (
          <li key={n.id} style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: selectedId === n.id ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedId(n.id)} style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left' }}>{n.title}</button>
              {story.startId === n.id && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}><Flag size={11} /> Start</span>}
              {n.ending && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>Ending</span>}
              {flagged.has(n.id) && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b45309' }}>Needs attention</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 6px' }}>{n.text.replace(/\s+/g, ' ').trim().slice(0, 140) || 'No text yet'}</div>
            {n.choices.map(c => {
              const target = c.to ? nodeById(story, c.to) : undefined;
              return (
                <div key={c.id} style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span>“{c.label || '…'}” →</span>
                  {target ? <button onClick={() => setSelectedId(target.id)} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', textDecoration: 'underline', cursor: 'pointer' }}>{target.title}</button> : <em style={{ color: 'var(--text-muted)' }}>not connected</em>}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', backgroundColor: 'var(--bg-app)', overflow: 'hidden' }}>
      {header}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: narrow ? 'column' : 'row' }}>
        <div style={{ flex: narrow && selected ? '0 0 38%' : 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {mode === 'map'
            ? <BranchMap story={story} selectedId={selectedId} flagged={flagged} onSelect={setSelectedId} onMove={(id, x, y) => save(updateNode(story, id, { x, y }))} />
            : list}
        </div>
        {panel}
      </main>

      {playing && (
        <DialogFrame label="Play your story" onClose={() => setPlaying(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: narrow ? 0 : 20 }}>
          <div style={{ width: '100%', maxWidth: 780, height: narrow ? '100%' : '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-paper)', borderRadius: narrow ? 0 : 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>This is what your reader sees</strong>
              <button onClick={() => setPlaying(false)} aria-label="Close" style={{ padding: 4, display: 'flex', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <iframe title="Story preview" sandbox="allow-scripts" srcDoc={buildPlayableHtml(story)} style={{ flex: 1, border: 'none', width: '100%' }} />
          </div>
        </DialogFrame>
      )}
    </div>
  );
};
