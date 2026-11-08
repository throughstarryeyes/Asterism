import React, { useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { KIND_LABEL, insertSceneAsChapter, makeScene, openSuggestions, type Suggestion } from '../../services/play/missingScene';
import { htmlToText, textToHtml } from '../../services/play/rng';
import type { OptionalScene } from '../../services/play/types';
import { DocSelect, Muted, Panel, Row, Story, area, btn, btnPrimary, field, useDocs } from './ui';

// finds moments the story has set up but not shown. a gap is never called a mistake: the writer can write it, keep it aside, or say it is on purpose.
export const MissingSceneGame: React.FC = () => {
  const { updateAnyProject, showToast, notePlay } = useAsterism();
  const { docs, doc, docId, setDocId } = useDocs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);

  const suggestions = useMemo(() => (doc ? openSuggestions(doc) : []), [doc]);
  const scenes = doc?.play?.scenes ?? [];
  const dismissed = doc?.play?.dismissed ?? [];

  if (!doc) return <Panel><Muted>Make a document first. This game reads its chapters, characters and timeline.</Muted></Panel>;

  const chapterName = (id?: string) => doc.chapters.find(c => c.id === id)?.title;
  const open = (s: Suggestion) => { setOpenId(s.id); setTitle(s.title); setText(''); setAnswers(s.reflections.map(() => '')); };
  const setPlay = (play: NonNullable<typeof doc.play>) => updateAnyProject(doc.id, { play: { ...doc.play, ...play } });

  const keep = (s: Suggestion, intoManuscript: boolean) => {
    if (!text.trim()) { showToast('Write a few words first, or answer a question and keep that.', 'info'); return; }
    const scene: OptionalScene = {
      ...makeScene(s, title, textToHtml(text), s.reflections.map((q, i) => ({ question: q, answer: answers[i] ?? '' }))),
      ...(intoManuscript ? { inManuscript: true } : {}),
    };
    updateAnyProject(doc.id, {
      play: { ...doc.play, scenes: [...scenes, scene] },
      ...(intoManuscript ? { chapters: insertSceneAsChapter(doc.chapters, scene) } : {}),
    });
    showToast(intoManuscript ? 'Added to your manuscript.' : 'Kept as an optional scene. It is not in your manuscript.', 'success');
    notePlay('Wrote a missing scene');
    setOpenId(null);
  };

  const keepReflections = (s: Suggestion) => {
    if (!answers.some(a => a.trim())) { showToast('Answer a question first.', 'info'); return; }
    const scene = makeScene(s, title, '', s.reflections.map((q, i) => ({ question: q, answer: answers[i] ?? '' })));
    updateAnyProject(doc.id, { play: { ...doc.play, scenes: [...scenes, { ...scene, title: `Notes: ${scene.title}` }] } });
    showToast('Kept your answers. No scene needed.', 'success');
    notePlay('Thought through a missing scene');
    setOpenId(null);
  };

  const dismiss = (s: Suggestion) => { setPlay({ dismissed: [...dismissed, s.id] }); setOpenId(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Missing Scene" note="These are places the story could go, noticed from your chapters, timeline, characters and secrets. A gap is not a mistake. Sometimes what the story leaves out is exactly right, and you can say so.">
        <Row style={{ alignItems: 'flex-end' }}>
          <DocSelect docs={docs} value={docId} onChange={id => { setDocId(id); setOpenId(null); }} />
          {dismissed.length > 0 && <button style={btn} onClick={() => setPlay({ dismissed: [] })}>Bring back the {dismissed.length} I set aside</button>}
        </Row>
      </Panel>

      {suggestions.length === 0 && (
        <Panel>
          <Story>Nothing stands out right now.</Story>
          <Muted>This works best with a few chapters, characters whose relationships are filled in, and a timeline. Check back as the story grows.</Muted>
        </Panel>
      )}

      {suggestions.map(s => {
        const isOpen = openId === s.id;
        return (
          <Panel key={s.id} title={KIND_LABEL[s.kind]}>
            <Story>{s.title}</Story>
            <Muted>{s.text}</Muted>
            {!isOpen && (
              <Row>
                <button style={btnPrimary} onClick={() => open(s)}>Explore this</button>
                <button style={btn} onClick={() => dismiss(s)} title="This is on purpose, so stop suggesting it">It is intentional</button>
              </Row>
            )}
            {isOpen && (
              <>
                <Label3 text="Think about it">
                  {s.reflections.map((q, i) => (
                    <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Muted>{q}</Muted>
                      <textarea aria-label={q} rows={2} value={answers[i] ?? ''} onChange={e => setAnswers(a => a.map((x, j) => (j === i ? e.target.value : x)))} style={area} />
                    </div>
                  ))}
                </Label3>
                <Label3 text="Or write it">
                  <input aria-label="Scene title" value={title} onChange={e => setTitle(e.target.value)} style={field} />
                  <textarea aria-label="The scene" rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="Write the scene here…" style={area} />
                </Label3>
                <Row>
                  <button style={btnPrimary} onClick={() => keep(s, false)}>Keep as an optional scene</button>
                  <button style={btn} onClick={() => keep(s, true)}>Add to my manuscript{chapterName(s.afterChapterId) ? ` after ${chapterName(s.afterChapterId)}` : ''}</button>
                  <button style={btn} onClick={() => keepReflections(s)}>Keep just my answers</button>
                  <button style={btn} onClick={() => dismiss(s)}>It is intentional</button>
                  <button style={btn} onClick={() => setOpenId(null)}>Not now</button>
                </Row>
              </>
            )}
          </Panel>
        );
      })}

      {scenes.length > 0 && (
        <Panel title="Your optional scenes" note="Kept beside the manuscript, not in it, until you decide.">
          {scenes.map(sc => (
            <div key={sc.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <Story>{sc.title}</Story>
              <Muted>
                {sc.chapterId && chapterName(sc.chapterId) ? `Follows ${chapterName(sc.chapterId)}. ` : ''}
                {sc.inManuscript ? 'In your manuscript.' : 'Not in your manuscript.'}
              </Muted>
              {sc.html && <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.88rem', lineHeight: 1.55, maxHeight: 120, overflow: 'hidden' }}>{htmlToText(sc.html).slice(0, 400)}</p>}
              {sc.reflections?.map(r => <Muted key={r.question}><em>{r.question}</em> {r.answer}</Muted>)}
              <Row>
                {!sc.inManuscript && sc.html && (
                  <button style={btn} onClick={() => updateAnyProject(doc.id, { chapters: insertSceneAsChapter(doc.chapters, sc), play: { ...doc.play, scenes: scenes.map(x => (x.id === sc.id ? { ...x, inManuscript: true } : x)) } })}>Add to manuscript</button>
                )}
                <button style={btn} onClick={() => updateAnyProject(doc.id, { play: { ...doc.play, scenes: scenes.filter(x => x.id !== sc.id) } })}>Remove</button>
              </Row>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
};

const Label3: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{text}</span>
    {children}
  </div>
);
