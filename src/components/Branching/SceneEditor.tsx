import React, { useState } from 'react';
import { MAX_CHOICES, type BranchNode, type BranchingStory } from '../../services/branching';
import { ArrowRight, Flag, Plus, Trash2 } from 'lucide-react';

interface Props {
  story: BranchingStory;
  node: BranchNode;
  onChange: (change: Partial<BranchNode>) => void;
  onAddChoice: () => void;
  onChoice: (choiceId: string, change: { label?: string; reaction?: string; to?: string }) => void;
  onRemoveChoice: (choiceId: string) => void;
  onBranchOut: (choiceId: string) => void;
  onMakeStart: () => void;
  onRemove: () => void;
  onGo: (id: string) => void;
}

const field: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: '0.88rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', boxSizing: 'border-box' };
const label: React.CSSProperties = { display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '10px 0 4px' };

// one scene: what the reader reads, then the choices they can make
export const SceneEditor: React.FC<Props> = ({ story, node, onChange, onAddChoice, onChoice, onRemoveChoice, onBranchOut, onMakeStart, onRemove, onGo }) => {
  const [confirm, setConfirm] = useState(false);
  const isStart = story.startId === node.id;
  const others = story.nodes.filter(n => n.id !== node.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label htmlFor="scene-title" style={label}>Scene name</label>
      <input id="scene-title" value={node.title} maxLength={80} onChange={e => onChange({ title: e.target.value })} style={field} />

      <label htmlFor="scene-text" style={label}>What the reader sees</label>
      <textarea id="scene-text" value={node.text} rows={8} onChange={e => onChange({ text: e.target.value })} placeholder="Write the scene. Leave a blank line between paragraphs." style={{ ...field, resize: 'vertical', lineHeight: 1.55, fontFamily: 'var(--font-body)' }} />
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Use *italics* and **bold** if you like.</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '10px 0 2px', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer' }}>
          <input type="checkbox" checked={node.ending} onChange={e => onChange({ ending: e.target.checked })} />
          This is an ending
        </label>
        {isStart ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}><Flag size={13} /> The story starts here</span>
        ) : (
          <button onClick={onMakeStart} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}><Flag size={13} /> Start the story here</button>
        )}
      </div>

      {!node.ending && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 2px' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>Choices</h2>
            <button onClick={onAddChoice} disabled={node.choices.length >= MAX_CHOICES} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))', cursor: 'pointer', opacity: node.choices.length >= MAX_CHOICES ? 0.5 : 1 }}>
              <Plus size={13} /> Add a choice
            </button>
          </div>
          {node.choices.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No choices yet. Without any, the reader gets stuck here.</div>}
          {node.choices.map((c, i) => (
            <fieldset key={c.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '4px 10px 10px', margin: '8px 0 0', backgroundColor: 'var(--bg-paper)' }}>
              <legend style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>Choice {i + 1}</legend>
              <label htmlFor={`c-label-${c.id}`} style={label}>What the reader picks</label>
              <input id={`c-label-${c.id}`} value={c.label} maxLength={200} placeholder="Open the door" onChange={e => onChoice(c.id, { label: e.target.value })} style={field} />
              <label htmlFor={`c-react-${c.id}`} style={label}>Reaction (shown right after)</label>
              <textarea id={`c-react-${c.id}`} value={c.reaction} rows={2} placeholder="Optional. How the world answers." onChange={e => onChoice(c.id, { reaction: e.target.value })} style={{ ...field, resize: 'vertical' }} />
              <label htmlFor={`c-to-${c.id}`} style={label}>Leads to</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select id={`c-to-${c.id}`} value={c.to} onChange={e => onChoice(c.id, { to: e.target.value })} style={{ ...field, flex: 1 }}>
                  <option value="">Not connected yet</option>
                  {others.map(n => <option key={n.id} value={n.id}>{n.title}{n.ending ? ' (ending)' : ''}</option>)}
                </select>
                {c.to
                  ? <button onClick={() => onGo(c.to)} aria-label="Go to that scene" title="Go to that scene" style={{ padding: '0 10px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}><ArrowRight size={15} /></button>
                  : <button onClick={() => onBranchOut(c.id)} style={{ padding: '0 10px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>New scene</button>}
              </div>
              <button onClick={() => onRemoveChoice(c.id)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={12} /> Remove this choice</button>
            </fieldset>
          ))}
        </>
      )}

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        {confirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Delete this scene? Choices leading here will be unconnected.</span>
            <button onClick={() => { setConfirm(false); onRemove(); }} style={{ padding: '4px 10px', fontWeight: 600, color: '#fff', backgroundColor: '#dc2626', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Delete</button>
            <button onClick={() => setConfirm(false)} style={{ padding: '4px 8px', color: 'var(--text-muted)', cursor: 'pointer' }}>Keep</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={13} /> Delete this scene</button>
        )}
      </div>
    </div>
  );
};
