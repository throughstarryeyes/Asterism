import { Loader } from '../Common/Loader';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { TimelineEvent } from '../../types';
import { readStory } from '../../services/analysisClient';
import {
  addEvent, describeReading, detectTimeCues, isTimelineFinding, moveEvent, newEvent, outOfOrder, pagePositions, readTimeline,
  removeEvent, saveEvent, type TimeCue, type Telling
} from '../../services/timeline';
import { describeSpec, readTime } from '../../services/timeExpressions';
import { PassageLink } from '../Common/PassageLink';
import { CalendarClock, ChevronDown, ChevronRight, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';

const small: React.CSSProperties = { fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 };
const pill: React.CSSProperties = { padding: '3px 8px', fontSize: '0.72rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)' };
const sectionTitle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' };
const note: React.CSSProperties = { ...small, padding: '6px 8px', borderLeft: '2px solid var(--accent-gold)', backgroundColor: 'var(--tag-bg)', borderRadius: 'var(--radius-sm)' };
const field: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: '0.8rem', color: 'var(--text-main)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' };
const label: React.CSSProperties = { ...small, display: 'flex', flexDirection: 'column', gap: 2 };

const TELLING_LABEL: Record<Telling, string> = { flashback: 'Flashback', 'flash-forward': 'Told early' };

interface Draft {
  id?: string;
  title: string;
  when: string;
  relativeTo: string;
  characters: string;
  notes: string;
  chapterId?: string;
  quote?: string;
}

const blank = (patch: Partial<Draft> = {}): Draft => ({ title: '', when: '', relativeTo: '', characters: '', notes: '', ...patch });

const shorten = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

export const TimelinePanel: React.FC = () => {
  const { project, updateProject, respondToFinding, activeChapterId, showToast, setSidebarTab } = useAsterism();
  const events = useMemo(() => project.timeline ?? [], [project.timeline]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [cues, setCues] = useState<TimeCue[] | null>(null);
  const [showCues, setShowCues] = useState(false);
  const [findingCues, setFindingCues] = useState(false);

  const setEvents = (next: TimelineEvent[]) => updateProject({ timeline: next });

  // where each event is told. reading the whole book is the costly part, so it waits for a pause.
  const [telling, setTelling] = useState<Map<number, Telling>>(new Map());
  useEffect(() => {
    const timer = window.setTimeout(() => setTelling(outOfOrder(pagePositions(events, project.chapters))), 700);
    return () => window.clearTimeout(timer);
  }, [events, project.chapters]);

  // where each event sits on the calendar, where its words allow.
  const readings = useMemo(() => readTimeline(events), [events]);

  // the checks are analyzer findings, kept in step with the timeline, so they are answered once.
  const issues = (project.findings || []).filter(f => isTimelineFinding(f) && f.status === 'unreviewed');

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

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft?.title.trim()) return;
    const fields = {
      title: draft.title,
      when: draft.when.trim() || undefined,
      relativeTo: draft.relativeTo || undefined,
      characters: draft.characters.split(','),
      notes: draft.notes.trim() || undefined,
      chapterId: draft.chapterId,
      quote: draft.quote
    };
    if (draft.id) {
      const old = events.find(e => e.id === draft.id);
      if (!old) return;
      const moved = old.quote !== fields.quote || old.chapterId !== fields.chapterId;
      const next = { ...newEvent(fields), id: old.id, createdAt: old.createdAt, ...(moved ? {} : { before: old.before, after: old.after }) };
      setEvents(saveEvent(events, next));
    } else {
      setEvents(addEvent(events, newEvent(fields), project.chapters));
    }
    setDraft(null);
  };

  const edit = (event: TimelineEvent) =>
    setDraft(blank({
      id: event.id, title: event.title, when: event.when ?? event.date ?? '', relativeTo: event.relativeTo ?? '', characters: (event.characters ?? []).join(', '),
      notes: event.notes ?? '', chapterId: event.chapterId, quote: event.quote
    }));

  const toggleCues = () => {
    if (showCues) { setShowCues(false); return; }
    setShowCues(true);
    setFindingCues(true);
    // the list opens first; the story is read on a background worker
    readStory({ chapters: project.chapters, storyBible: project.storyBible, draftMode: project.draftMode, memoryVault: project.memoryVault }).then(({ coachUnits }) => {
      setCues(detectTimeCues(coachUnits));
      setFindingCues(false);
    }, () => setFindingCues(false));
  };

  const addCue = (cue: TimeCue) => {
    const made = newEvent({ title: shorten(cue.sentence, 60), when: cue.text, chapterId: cue.chapterId, quote: cue.sentence });
    setEvents(addEvent(events, made, project.chapters));
    setDraft(blank({ id: made.id, title: made.title, when: made.when ?? '', chapterId: made.chapterId, quote: made.quote }));
  };

  // a cue is "taken" when an event is already told in that sentence.
  const taken = (cue: TimeCue) => events.some(e => e.chapterId === cue.chapterId && e.quote && cue.sentence.toLowerCase().includes(e.quote.toLowerCase().slice(0, 50)));
  const openCues = (cues ?? []).filter(c => !taken(c));

  // what the "when" says, shown back to the writer as they type.
  const understood = draft?.when.trim() ? readTime(draft.when) : null;
  const isRelative = !!understood && understood.spec.kind !== 'abs';
  const others = events.filter(e => e.id !== draft?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarClock size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span style={{ ...sectionTitle, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Story timeline</span>
        </div>
        <button onClick={() => setDraft(blank())} style={{ ...pill, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={12} /> Add event
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2 }}>
        {draft && (
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)' }}>
            <label style={label}>
              What happens
              <input autoFocus value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="The mill fire" style={field} />
            </label>
            <label style={label}>
              When, in your words
              <input value={draft.when} onChange={e => setDraft({ ...draft, when: e.target.value })} placeholder="March 14th, 3/14/17, the Tuesday after, the night of the storm" style={field} />
              <span>
                {!draft.when.trim()
                  ? 'Dates, weekdays, “three days later”, or just words. Anything placeable on a calendar gets checked.'
                  : understood
                    ? `I read “${understood.text}” as ${describeSpec(understood.spec)}.`
                    : 'No time I can place. That’s fine; it stays where you put it.'}
              </span>
            </label>
            {isRelative && (
              <label style={label}>
                Counts from
                <select value={draft.relativeTo} onChange={e => setDraft({ ...draft, relativeTo: e.target.value })} style={field}>
                  <option value="">The event above it</option>
                  {others.map(e => <option key={e.id} value={e.id}>{shorten(e.title, 40)}</option>)}
                </select>
              </label>
            )}
            <label style={label}>
              Who is there (separate with commas)
              <input value={draft.characters} onChange={e => setDraft({ ...draft, characters: e.target.value })} placeholder="Mara, Dana" style={field} />
            </label>
            <label style={label}>
              Notes
              <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2} style={{ ...field, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={small}>Where the story tells it</span>
              {draft.quote && <PassageLink chapterId={draft.chapterId} quote={draft.quote} commentText="" allowComment={false} />}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { const picked = readSelection(); if (picked) setDraft({ ...draft, ...picked }); }}
                  title="Select a passage in your document, then press this"
                  style={pill}
                >
                  {draft.quote ? 'Use my selected text instead' : 'Link my selected text'}
                </button>
                {draft.quote && <button type="button" onClick={() => setDraft({ ...draft, chapterId: undefined, quote: undefined })} style={pill}>Unlink</button>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDraft(null)} style={pill}>Cancel</button>
              <button type="submit" disabled={!draft.title.trim()} style={{ ...pill, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', opacity: !draft.title.trim() ? 0.5 : 1 }}>Save</button>
            </div>
          </form>
        )}

        {!events.length && !draft && (
          <div style={note}>
            Add events in the order they happen and link each to its passage. Flashbacks show up on their own. Time clues in your writing are below.
          </div>
        )}

        {issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={sectionTitle}>Worth a look</div>
            {issues.map(issue => (
              <div key={issue.id} style={note}>
                {issue.summary}
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <button style={pill} onClick={() => respondToFinding(issue.id, 'intentional')}>That’s intentional</button>
                  <button style={pill} onClick={() => respondToFinding(issue.id, 'dismissed')}>Not an issue</button>
                </div>
              </div>
            ))}
            <div style={{ ...small, fontSize: '0.7rem' }}>
              These also appear in the <button onClick={() => setSidebarTab('analyzer')} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>Analyzer</button>, and answering one there answers it here.
            </div>
          </div>
        )}

        {events.length > 0 && (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((event, i) => {
              const mark = telling.get(i);
              const reading = describeReading(readings[i]);
              return (
                <li key={event.id} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', marginTop: 5, backgroundColor: mark ? 'var(--accent-primary)' : 'var(--accent-gold)' }} />
                    {i < events.length - 1 && <span style={{ flex: 1, width: 1, backgroundColor: 'var(--border-strong)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>{event.title}</span>
                      {mark && <span style={{ ...small, fontSize: '0.68rem', padding: '1px 6px', borderRadius: 999, border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>{TELLING_LABEL[mark]}</span>}
                    </div>
                    {(event.when || event.date) && <div style={small}>{event.when ?? event.date}</div>}
                    {reading
                      ? <div style={{ ...small, color: 'var(--accent-gold-text, var(--accent-gold))' }}>{reading.label}{reading.note ? ` · ${reading.note}` : ''}</div>
                      : event.when ? <div style={{ ...small, fontStyle: 'italic' }}>In words only, so it isn’t checked against dates.</div> : null}
                    {!!event.characters?.length && <div style={small}>With {event.characters.join(', ')}</div>}
                    {event.notes && <div style={small}>{event.notes}</div>}
                    {event.quote && <PassageLink chapterId={event.chapterId} quote={event.quote} commentText={`Timeline: ${event.title}`} allowComment={false} />}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={pill} onClick={() => setEvents(moveEvent(events, event.id, -1))} disabled={i === 0} title="Happens earlier" aria-label="Move earlier"><ChevronUp size={12} /></button>
                      <button style={pill} onClick={() => setEvents(moveEvent(events, event.id, 1))} disabled={i === events.length - 1} title="Happens later" aria-label="Move later"><ChevronDown size={12} /></button>
                      <button style={pill} onClick={() => edit(event)} title="Edit" aria-label="Edit event"><Pencil size={12} /></button>
                      <button style={pill} onClick={() => setEvents(removeEvent(events, event.id))} title="Remove" aria-label="Remove event"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={toggleCues} style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left' }}>
            {showCues ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Time clues in your writing
          </button>
          {showCues && (
            <>
              <div style={small}>Places where the text says when something happens. Add the ones that matter.</div>
              {findingCues && <Loader message="Looking for time clues…" />}
              {cues && openCues.length === 0 && <div style={small}>No new clues. Dates, “three days later”, “the next morning” and the like show up here.</div>}
              {openCues.slice(0, 60).map(cue => (
                <div key={cue.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PassageLink chapterId={cue.chapterId} quote={cue.sentence} where={`${cue.unitTitle} · “${cue.text}” (${cue.label})`} commentText="" allowComment={false} />
                  </div>
                  <button style={pill} onClick={() => addCue(cue)}>Add</button>
                </div>
              ))}
              {openCues.length > 60 && <div style={small}>…and {openCues.length - 60} more.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
