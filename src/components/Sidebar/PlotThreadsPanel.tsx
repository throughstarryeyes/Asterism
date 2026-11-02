import { Loader } from '../Common/Loader';
import React, { useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { PlotThread, ThreadPassage, ThreadType, ThreadStatus } from '../../types';
import { readStory } from '../../services/analysisClient';
import type { CoachUnit, EntityIndex } from '../../services/coach/entities';
import {
  addExpectation, linkPassage, rejectLink, relinkPassage, removeExpectation, setExpectationStatus,
  suggestFollowUps, suggestForExpectation, threadProgress, unlinkPassage
} from '../../services/threads';
import { PassageLink } from '../Common/PassageLink';
import { GitBranch, Plus, Trash2, Quote, ChevronDown, ChevronRight, X } from 'lucide-react';

const ROLE_LABEL: Record<ThreadPassage['role'], string> = { setup: 'Setup', development: 'Follows it', payoff: 'Pays it off' };

const small: React.CSSProperties = { fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 };
const pill: React.CSSProperties = { padding: '3px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)' };
const section: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' };
const sectionTitle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' };
const lostNote: React.CSSProperties = { fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4, padding: '4px 8px', borderLeft: '2px solid var(--accent-gold)', backgroundColor: 'var(--tag-bg)', borderRadius: 'var(--radius-sm)' };

// what the tracker looked at when the thread was opened.
interface Scan {
  threadId: string;
  units: CoachUnit[];
  index: EntityIndex;
}

export const PlotThreadsPanel: React.FC = () => {
  const {
    project,
    savePlotThread,
    deletePlotThread,
    activeChapterId,
    showToast
  } = useAsterism();

  const [statusFilter, setStatusFilter] = useState<ThreadStatus | 'all'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  // the thread whose passages are being looked for
  const [reading, setReading] = useState<string | null>(null);
  const [expectationText, setExpectationText] = useState('');
  const [threadForm, setThreadForm] = useState<Partial<PlotThread>>({
    type: 'mystery',
    status: 'introduced',
    importance: 'major'
  });

  const statuses: Array<{ id: ThreadStatus | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'introduced', label: 'Introduced' },
    { id: 'simmering', label: 'Simmering' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'intentionally_open', label: 'Open' }
  ];

  const filteredThreads = project.plotThreads.filter(t =>
    statusFilter === 'all' || t.status === statusFilter
  );

  const handleOpenAdd = () => {
    setThreadForm({
      id: `thread-${Date.now()}`,
      title: '',
      type: 'mystery',
      status: 'introduced',
      importance: 'major',
      notes: '',
      passageQuote: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (threadForm.title?.trim()) {
      savePlotThread(threadForm as PlotThread);
      setIsAdding(false);
    }
  };

  const cycleStatus = (thread: PlotThread) => {
    const cycleMap: Record<ThreadStatus, ThreadStatus> = {
      'introduced': 'simmering',
      'simmering': 'resolved',
      'resolved': 'intentionally_open',
      'intentionally_open': 'introduced'
    };
    savePlotThread({
      ...thread,
      status: cycleMap[thread.status],
      updatedAt: new Date().toISOString()
    });
  };

  // small edits (a link, an expectation) save without a toast each time.
  const edit = (next: PlotThread) => savePlotThread(next, { quiet: true });

  // reading the whole manuscript is the expensive part, so it happens when a thread is opened,
  // not as the writer types.
  const toggleOpen = (thread: PlotThread) => {
    if (openId === thread.id) {
      setOpenId(null);
      return;
    }
    setOpenId(thread.id);
    setExpectationText('');
    setReading(thread.id);
    // the thread opens first; the story is read on a background worker
    readStory({ chapters: project.chapters, storyBible: project.storyBible, draftMode: project.draftMode, memoryVault: project.memoryVault }).then(({ coachUnits, index }) => {
      setScan({ threadId: thread.id, units: coachUnits, index });
      setReading(null);
    }, () => setReading(null));
  };

  // the passage selected in the document, if any.
  const readSelection = (): { chapterId: string; quote: string } | null => {
    const selection = window.getSelection();
    const quote = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';
    const node = selection?.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    const host = el?.closest('.editable-manuscript') as HTMLElement | null;
    const chapterId = host?.dataset.chapterId || activeChapterId;
    if (!quote || !host || !chapterId) {
      showToast('Select the passage in your document first, then press this.', 'info');
      return null;
    }
    return { chapterId, quote: quote.slice(0, 300) };
  };

  const linkSelection = (thread: PlotThread) => {
    const picked = readSelection();
    if (picked) edit(linkPassage(thread, { ...picked, role: 'development' }));
  };

  const relinkSelection = (thread: PlotThread, passageId: string) => {
    const picked = readSelection();
    if (picked) edit(relinkPassage(thread, passageId, picked.chapterId, picked.quote));
  };

  const suggestions = useMemo(() => {
    const thread = project.plotThreads.find(t => t.id === openId);
    if (!thread || !scan || scan.threadId !== thread.id) return null;
    return {
      thread: suggestFollowUps(thread, scan.units, scan.index),
      byExpectation: Object.fromEntries(
        (thread.expectations ?? []).filter(e => e.status === 'open').map(e => [e.id, suggestForExpectation(thread, e, scan.units, scan.index)])
      )
    };
  }, [project.plotThreads, openId, scan]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GitBranch size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Plot Threads ({project.plotThreads.length})
          </span>
        </div>
        <button
          onClick={handleOpenAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.78rem',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-gold-bg)',
            color: 'var(--accent-gold-text, var(--accent-gold))',
            fontWeight: 600
          }}
        >
          <Plus size={14} />
          <span>Track Thread</span>
        </button>
      </div>

      {/* status filter tabs */}
      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
        {statuses.map(s => (
          <button
            key={s.id}
            onClick={() => setStatusFilter(s.id)}
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              backgroundColor: statusFilter === s.id ? 'var(--accent-primary)' : 'var(--badge-bg)',
              color: statusFilter === s.id ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* add thread form */}
      {isAdding && (
        <form onSubmit={handleSave} style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 600 }}>Track New Narrative Thread</div>

          <input
            type="text"
            placeholder="Thread Title (e.g. The Locked Astrolabe Box)..."
            value={threadForm.title || ''}
            onChange={e => setThreadForm({ ...threadForm, title: e.target.value })}
            style={{ padding: '6px 10px' }}
            required
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={threadForm.type || 'mystery'}
              onChange={e => setThreadForm({ ...threadForm, type: e.target.value as ThreadType })}
              style={{ flex: 1, padding: '5px' }}
            >
              <option value="mystery">Mystery</option>
              <option value="promise">Promise</option>
              <option value="secret">Secret</option>
              <option value="foreshadowing">Foreshadowing</option>
              <option value="conflict">Conflict</option>
              <option value="unanswered_question">Unanswered Question</option>
            </select>

            <select
              value={threadForm.status || 'introduced'}
              onChange={e => setThreadForm({ ...threadForm, status: e.target.value as ThreadStatus })}
              style={{ flex: 1, padding: '5px' }}
            >
              <option value="introduced">Introduced</option>
              <option value="simmering">Simmering</option>
              <option value="resolved">Resolved</option>
              <option value="intentionally_open">Intentionally Open</option>
            </select>
          </div>

          <textarea
            placeholder="Notes on where this leads or why it matters..."
            value={threadForm.notes || ''}
            onChange={e => setThreadForm({ ...threadForm, notes: e.target.value })}
            rows={2}
            style={{ padding: '6px 10px', resize: 'vertical' }}
          />

          <input
            type="text"
            placeholder="Optional text excerpt or quote from manuscript..."
            value={threadForm.passageQuote || ''}
            onChange={e => setThreadForm({ ...threadForm, passageQuote: e.target.value })}
            style={{ padding: '6px 10px' }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="submit" style={{ flex: 1, padding: '6px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
              Track Thread
            </button>
            <button type="button" onClick={() => setIsAdding(false)} style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* threads list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {project.plotThreads.length === 0 && !isAdding && (
          <div style={{ ...small, padding: '16px', textAlign: 'center' }}>
            No threads yet. Track one here, or use “Track as plot thread” on a finding or Coach item.
          </div>
        )}

        {filteredThreads.map(thread => {
          let statusBadgeColor = 'var(--text-secondary)';
          let statusBg = 'var(--badge-bg)';
          if (thread.status === 'resolved') {
            statusBadgeColor = '#10b981';
            statusBg = 'rgba(16, 185, 129, 0.12)';
          } else if (thread.status === 'simmering') {
            statusBadgeColor = 'var(--accent-gold)';
            statusBg = 'var(--accent-gold-bg)';
          } else if (thread.status === 'intentionally_open') {
            statusBadgeColor = '#8b5cf6';
            statusBg = 'rgba(139, 92, 246, 0.12)';
          }

          const isOpen = openId === thread.id;
          const progress = threadProgress(thread);
          const quiet = suggestions && isOpen && suggestions.thread.length === 0 && progress.passages === 0;

          return (
            <div
              key={thread.id}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <button
                  onClick={() => toggleOpen(thread)}
                  title={isOpen ? 'Hide details' : 'Show passages and expectations'}
                  style={{ textAlign: 'left', display: 'flex', gap: '4px', alignItems: 'flex-start', flex: 1 }}
                >
                  {isOpen ? <ChevronDown size={14} style={{ marginTop: 3, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ marginTop: 3, flexShrink: 0 }} />}
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {thread.title}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.72rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                      {thread.type.replace('_', ' ')}
                      {progress.passages > 0 && ` · ${progress.passages} passage${progress.passages === 1 ? '' : 's'}`}
                      {progress.expectations > 0 && ` · ${progress.fulfilled}/${progress.expectations} expectations met`}
                    </span>
                  </span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {/* clickable status badge to cycle state */}
                  <button
                    onClick={() => cycleStatus(thread)}
                    title="Click to cycle status (Introduced → Simmering → Resolved → Intentionally Open)"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: statusBg,
                      color: statusBadgeColor,
                      border: `1px solid ${statusBadgeColor}30`,
                      textTransform: 'capitalize'
                    }}
                  >
                    {thread.status.replace('_', ' ')}
                  </button>

                  <button aria-label="Delete thread"
                    onClick={() => deletePlotThread(thread.id)}
                    style={{ padding: '3px', color: 'var(--text-muted)' }}
                    title="Delete thread"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {thread.notes && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {thread.notes}
                </div>
              )}

              {thread.passageQuote && !isOpen && (
                <div style={{ fontSize: '0.76rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontStyle: 'italic', display: 'flex', alignItems: 'baseline', gap: '4px', backgroundColor: 'var(--tag-bg)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <Quote size={11} style={{ flexShrink: 0 }} />
                  <span>"{thread.passageQuote}"</span>
                </div>
              )}

              {isOpen && (
                <>
                  {/* where it began, and what the writer has confirmed since */}
                  <div style={section}>
                    <div style={sectionTitle}>Passages</div>
                    {thread.passageQuote && (
                      <>
                        <PassageLink
                          chapterId={thread.introducedInChapterId}
                          quote={thread.passageQuote}
                          where="Raised"
                          commentText={`Plot thread: ${thread.title}`}
                          allowComment={false}
                        />
                        {thread.originLost && <div style={lostNote}>I can’t find where this was raised any more. It may have been cut or rewritten.</div>}
                      </>
                    )}
                    {(thread.passages ?? []).map(passage => (
                      <div key={passage.id} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <PassageLink chapterId={passage.chapterId} quote={passage.quote} where={ROLE_LABEL[passage.role]} commentText={`Plot thread: ${thread.title}`} allowComment={false} />
                          {passage.lost && (
                            <div style={lostNote}>
                              I can’t find this passage any more. It may have been cut or rewritten.
                              <button
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => relinkSelection(thread, passage.id)}
                                title="Select the new wording in your document, then press this"
                                style={{ ...pill, marginLeft: 6 }}
                              >
                                Use my selected text
                              </button>
                            </div>
                          )}
                        </div>
                        <button onClick={() => edit(unlinkPassage(thread, passage.id))} title="Unlink this passage" style={{ color: 'var(--text-muted)', display: 'flex' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => linkSelection(thread)}
                      title="Select a passage in your document, then press this to add it to the thread"
                      style={{ ...pill, alignSelf: 'flex-start' }}
                    >
                      Link my selected text
                    </button>
                  </div>

                  {reading === thread.id && <Loader message="Looking for passages that pick this up…" />}
                  {/* later passages that seem to pick it up. suggestions, for the writer to judge. */}
                  <div style={section}>
                    <div style={sectionTitle}>Might follow this thread</div>
                    {suggestions && suggestions.thread.map(s => (
                      <div key={`${s.chapterId}|${s.sentence}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <PassageLink chapterId={s.chapterId} quote={s.sentence} where={s.unitTitle} commentText={`Plot thread: ${thread.title}`} allowComment={false} />
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button style={pill} onClick={() => edit(linkPassage(thread, { chapterId: s.chapterId, quote: s.sentence, role: 'development' }))}>Follows it</button>
                          <button style={pill} onClick={() => edit(linkPassage(thread, { chapterId: s.chapterId, quote: s.sentence, role: 'payoff' }))}>Pays it off</button>
                          <button style={{ ...pill, color: 'var(--text-muted)' }} onClick={() => edit(rejectLink(thread, s.chapterId, s.sentence))}>Not related</button>
                        </div>
                      </div>
                    ))}
                    {quiet && (
                      <div style={small}>
                        I couldn’t find a later passage that picks this up. If that’s on purpose, mark it Intentionally Open.
                      </div>
                    )}
                    {suggestions && suggestions.thread.length > 0 && (
                      <div style={small}>These are only guesses from matching words. You decide what belongs.</div>
                    )}
                  </div>

                  {/* what the writer expects the story to deliver */}
                  <div style={section}>
                    <div style={sectionTitle}>What I expect from this</div>
                    {(thread.expectations ?? []).map(expectation => (
                      <div key={expectation.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <select
                            value={expectation.status}
                            onChange={e => edit(setExpectationStatus(thread, expectation.id, e.target.value as typeof expectation.status))}
                            style={{ fontSize: '0.72rem', padding: '2px 4px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}
                          >
                            <option value="open">Open</option>
                            <option value="fulfilled">Met</option>
                            <option value="abandoned">Let go</option>
                          </select>
                          <span style={{ ...small, flex: 1, textDecoration: expectation.status === 'open' ? 'none' : 'line-through' }}>{expectation.text}</span>
                          <button onClick={() => edit(removeExpectation(thread, expectation.id))} title="Remove" style={{ color: 'var(--text-muted)', display: 'flex' }}>
                            <X size={13} />
                          </button>
                        </div>
                        {suggestions?.byExpectation[expectation.id]?.map(s => (
                          <div key={`${s.chapterId}|${s.sentence}`} style={{ marginLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <PassageLink chapterId={s.chapterId} quote={s.sentence} where={s.unitTitle} commentText={`Plot thread: ${thread.title}`} allowComment={false} />
                            <button
                              style={{ ...pill, alignSelf: 'flex-start' }}
                              onClick={() => edit(setExpectationStatus(linkPassage(thread, { chapterId: s.chapterId, quote: s.sentence, role: 'payoff' }), expectation.id, 'fulfilled'))}
                            >
                              This delivers it
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (!expectationText.trim()) return;
                        edit(addExpectation(thread, expectationText));
                        setExpectationText('');
                      }}
                      style={{ display: 'flex', gap: '4px' }}
                    >
                      <input
                        type="text"
                        value={expectationText}
                        onChange={e => setExpectationText(e.target.value)}
                        placeholder="e.g. Mara opens the box"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.76rem' }}
                      />
                      <button type="submit" style={pill}>Add</button>
                    </form>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
