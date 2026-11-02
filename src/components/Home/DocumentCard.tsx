import React, { useState } from 'react';
import type { Project } from '../../types';
import { sceneCount } from '../../services/openDraft';
import { storyStats } from '../../services/branching';
import { TOOL_LABELS } from '../../services/toolKinds';
import type { SearchHit } from '../../services/documentSearch';
import { sameTag } from '../../services/tags';
import { useAsterism } from '../../context/AsterismContext';
import { coverFor, coverPaint } from '../../services/looks';
import { CheckCircle2, Compass, Copy, Edit3, Folder, GitBranch, MoreHorizontal, Network, PenTool, Trash2, Users } from 'lucide-react';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

interface Props {
  project: Project;
  // the one that was open last, so "Open Word Processor" picks it up
  lastOpened: boolean;
  canDelete: boolean;
  // the first lines of the writing, shown when there is no synopsis
  preview?: string;
  // set while searching: where the words were found
  hit?: SearchHit;
  onOpen: () => void;
  // a tag was clicked: filter the list by it
  onToggleTag: (tag: string) => void;
  activeTags: string[];
  onMove: () => void;
  onEdit: () => void;
  onBible: () => void;
  onMindMap: () => void;
  onAlternate: () => void;
  onDraftDone: () => void;
  onDelete: () => void;
}

const kindIcon = (kind: NonNullable<Project['kind']>, size: number) =>
  kind === 'mindmap' ? <Network size={size} /> : kind === 'branching' ? <GitBranch size={size} /> : kind === 'character' ? <Users size={size} /> : <Compass size={size} />;

const chip: React.CSSProperties = { fontSize: '0.74rem', fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--radius-full)', cursor: 'pointer', whiteSpace: 'nowrap' };

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={e => { e.stopPropagation(); onClick(); }}
    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', fontSize: '0.8rem', textAlign: 'left', color: danger ? 'var(--accent-primary)' : 'var(--text-main)', cursor: 'pointer' }}
  >
    <span style={{ display: 'flex', color: danger ? 'inherit' : 'var(--text-secondary)' }}>{icon}</span>
    {label}
  </button>
);

// one document on the home page: click it to write; the rest is in the menu
export const DocumentCard: React.FC<Props> = ({ project, lastOpened, canDelete, preview, hit, onOpen, onToggleTag, activeTags, onMove, onEdit, onBible, onMindMap, onAlternate, onDraftDone, onDelete }) => {
  const [menu, setMenu] = useState(false);
  const { userStats } = useAsterism();
  // tool documents (maps, sheets) have no cover
  const cover = project.kind ? undefined : coverFor(project, userStats.activeCover, userStats.customCovers);
  const words = project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const open = project.draftMode === 'open_draft';
  const parts = project.kind === 'mindmap'
    ? [plural(project.mindMap.nodes.length, 'note'), plural(project.mindMap.edges.length, 'link')]
    : project.kind === 'branching'
      ? (project.branching ? [plural(storyStats(project.branching).scenes, 'scene'), plural(storyStats(project.branching).endings, 'ending')] : ['Empty'])
      : project.kind === 'cards'
        ? [plural(project.reflections.length, 'reflection')]
        : project.kind ? [plural(project.sheet?.rows.length ?? 0, 'row')]
      : [
        plural(words, 'word'),
        open ? plural(sceneCount(project.chapters[0]?.content ?? ''), 'scene') : plural(project.chapters.length, 'chapter'),
        plural(project.storyBible?.characters?.length || 0, 'character'),
      ];
  const synopsis = project.synopsis?.trim();

  return (
    <article
      className={menu ? 'doc-card menu-open' : 'doc-card'}
      onClick={onOpen}
      style={{
        padding: '22px', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '230px', position: 'relative',
        backgroundColor: lastOpened ? 'var(--accent-gold-bg)' : 'var(--bg-paper)',
        border: lastOpened ? '1.5px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
        boxShadow: lastOpened ? 'var(--shadow-md)' : 'var(--shadow-sm)', cursor: 'pointer',
      }}
    >
      {cover && cover.id !== 'plain' && (
        <div aria-hidden="true" style={{ margin: '-22px -22px 0', height: '46px', ...coverPaint(cover), color: cover.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', letterSpacing: '0.4em', borderRadius: 'calc(var(--radius-xl) - 1px) calc(var(--radius-xl) - 1px) 0 0', borderBottom: `3px solid ${cover.ink}` }}>
          {cover.glyph}
        </div>
      )}

      {/* what it is, and where it lives */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(project.tags ?? []).slice(0, 3).map(tag => {
            const on = activeTags.some(t => sameTag(t, tag));
            return (
              <button key={tag} onClick={e => { e.stopPropagation(); onToggleTag(tag); }} title={on ? `Stop filtering by ${tag}` : `Show only ${tag}`}
                style={{ ...chip, backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--tag-bg)', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', border: on ? '1px solid var(--accent-gold)' : 'none' }}>
                {tag}
              </button>
            );
          })}
          {(project.tags ?? []).length > 3 && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }} title={(project.tags ?? []).slice(3).join(', ')}>+{(project.tags ?? []).length - 3}</span>}
          {project.kind && <span style={{ ...chip, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--tag-bg)', color: 'var(--text-secondary)' }}>{kindIcon(project.kind, 11)}{TOOL_LABELS[project.kind]}</span>}
          {project.draftComplete && <span style={{ ...chip, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--accent-gold-bg)', color: 'var(--accent-gold-text, var(--accent-gold))' }}><CheckCircle2 size={11} /> First draft done</span>}
          {project.alternateOf && <span style={{ ...chip, backgroundColor: 'var(--tag-bg)', color: 'var(--text-secondary)' }} title="A copy made to try a different version">Alternate draft</span>}
          {project.folder && (
            <button onClick={e => { e.stopPropagation(); onMove(); }} title="Move to another folder" style={{ ...chip, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--accent-gold-bg)', color: 'var(--accent-gold-text, var(--accent-gold))', border: '1px solid var(--accent-gold)' }}>
              <Folder size={11} /> {project.folder}
            </button>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={e => { e.stopPropagation(); setMenu(!menu); }} title="More" aria-label="More options" style={{ padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <>
              <div onClick={e => { e.stopPropagation(); setMenu(false); }} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div className="glass-panel" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 21, minWidth: '190px', padding: '4px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
                <MenuItem icon={<Edit3 size={14} />} label="Edit title, author, tags…" onClick={() => { setMenu(false); onEdit(); }} />
                <MenuItem icon={<Folder size={14} />} label={project.folder ? 'Move to another folder' : 'Add to a folder'} onClick={() => { setMenu(false); onMove(); }} />
                {!project.kind && <MenuItem icon={<Users size={14} />} label="Story Bible" onClick={() => { setMenu(false); onBible(); }} />}
                {!project.kind && <MenuItem icon={<Network size={14} />} label="Mind map" onClick={() => { setMenu(false); onMindMap(); }} />}
                {!project.kind && <MenuItem icon={<CheckCircle2 size={14} />} label={project.draftComplete ? 'Mark draft as not finished' : 'Mark first draft finished'} onClick={() => { setMenu(false); onDraftDone(); }} />}
                {!project.kind && <MenuItem icon={<Copy size={14} />} label="Make an alternate draft" onClick={() => { setMenu(false); onAlternate(); }} />}
                {canDelete && <MenuItem icon={<Trash2 size={14} />} label="Delete document" danger onClick={() => { setMenu(false); onDelete(); }} />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* title, and the author only if there is one */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
          {/* the card is clickable for the mouse; this is the way in for the keyboard */}
          <button onClick={e => { e.stopPropagation(); onOpen(); }} style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', textTransform: 'inherit', letterSpacing: 'inherit' }}>{project.title}</button>
        </h2>
        {project.author?.trim() && <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '3px' }}>by {project.author.trim()}</div>}
      </div>

      {hit && hit.snippets.length > 0 ? (
        // while searching, show where the words are
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {hit.snippets.map((snippet, i) => (
            <p key={i} style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, fontStyle: 'italic' }}>
              {snippet.map((part, j) => part.hit
                ? <mark key={j} style={{ backgroundColor: 'var(--accent-gold-bg)', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600, borderRadius: '3px', padding: '0 2px' }}>{part.text}</mark>
                : <span key={j}>{part.text}</span>)}
            </p>
          ))}
        </div>
      ) : synopsis ? (
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{synopsis}</p>
      ) : preview ? (
        // no synopsis yet: the opening lines of the writing, in italics so it is not mistaken for one
        <p title="The first lines of your writing" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview}</p>
      ) : (
        <button className="doc-card-hint" onClick={e => { e.stopPropagation(); onEdit(); }} style={{ alignSelf: 'flex-start', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
          + Add a synopsis
        </button>
      )}

      {/* pinned to the bottom, so every card lines up */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center' }}>
          <span>{parts.join(' · ')}</span>
          {hit && hit.count > 0 && <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>{hit.count.toLocaleString()} {hit.count === 1 ? 'match' : 'matches'}</span>}
          {lastOpened && <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>Last opened</span>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onOpen(); }}
          style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', backgroundColor: lastOpened ? 'var(--accent-primary)' : 'var(--tag-bg)', border: lastOpened ? 'none' : '1px solid var(--border-strong)', color: lastOpened ? '#fff' : 'var(--text-main)', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
        >
          {project.kind ? kindIcon(project.kind, 14) : <PenTool size={14} />}
          <span>{lastOpened ? 'Continue writing' : 'Open'}</span>
        </button>
      </div>
    </article>
  );
};
