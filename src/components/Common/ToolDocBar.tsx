import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { ToolKind } from '../../types';
import { TOOL_LABELS } from '../../services/toolKinds';

const field: React.CSSProperties = { padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', maxWidth: 180 };

// name a tool document, and choose which manuscript it belongs to
export const ToolDocBar: React.FC<{ kind: ToolKind }> = ({ kind }) => {
  const { allProjects, project, toolDoc, toolFromDoc, attachTool, openTool, updateToolDoc } = useAsterism();
  const label = TOOL_LABELS[kind].toLowerCase();

  if (toolDoc.kind) {
    return (
      <>
        <input aria-label={`Name of this ${label}`} value={toolDoc.title} onChange={e => updateToolDoc({ title: e.target.value })} style={{ ...field, fontWeight: 600 }} />
        <select aria-label="Attached to" value={toolDoc.attachedTo ?? ''} onChange={e => attachTool(toolDoc.id, e.target.value || null)} style={field} title="The document this opens from">
          <option value="">Not attached</option>
          {allProjects.filter(p => !p.kind).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </>
    );
  }

  // a manuscript's own map or story: offer to switch to a separate one
  const others = allProjects.filter(p => p.kind === kind);
  if (!toolFromDoc || others.length === 0) return null;
  return (
    <select aria-label={`Use a separate ${label}`} value="" onChange={e => { if (!e.target.value) return; attachTool(e.target.value, project.id); openTool(kind); }} style={field}>
      <option value="">Use a separate {label}…</option>
      {others.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
  );
};
