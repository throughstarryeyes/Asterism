import React, { useMemo, useState } from 'react';
import { Dices, Shuffle } from 'lucide-react';
import { relationBetween, tagLabel } from '../../services/relationships';
import { ROULETTE_MODES, rerollQuestion, rollRoulette, rollSituation, rouletteText, suggestMode, type RouletteMode, type RouletteResult } from '../../services/play/roulette';
import { randomName } from '../../services/play/mystery';
import { Chip, DocSelect, KeepBar, Label, Muted, Panel, Row, Story, area, btn, btnPrimary, field, useDocs } from './ui';

// two characters, a situation that forces them together, and questions about the pair. the aim is to learn something about them, not to write a scene.
export const RouletteGame: React.FC = () => {
  const { docs, doc, docId, setDocId } = useDocs();
  const characters = doc?.storyBible.characters ?? [];
  const [source, setSource] = useState<'story' | 'new'>('new');
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [mode, setMode] = useState<RouletteMode>('any');
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [learned, setLearned] = useState('');

  const fromStory = source === 'story' && characters.length >= 2;
  const a = fromStory ? characters.find(c => c.id === (idA || characters[0].id)) ?? characters[0] : undefined;
  const b = fromStory ? characters.find(c => c.id === (idB || characters[1].id) && c.id !== a?.id) ?? characters.find(c => c.id !== a?.id) : undefined;
  const names = fromStory ? { a: a?.name ?? '', b: b?.name ?? '' } : { a: nameA, b: nameB };
  const relation = useMemo(() => (a && b ? relationBetween(a, b) : { types: [], notes: [] }), [a, b]);
  const suggested = suggestMode(relation.types);

  const roll = (m: RouletteMode = mode) => {
    setResult(rollRoulette({ a: names.a, b: names.b, mode: m, tags: relation.types }));
    setLearned('');
  };
  const pickMode = (m: RouletteMode) => { setMode(m); if (result) roll(m); };
  const setAnswer = (i: number, text: string) => result && setResult({ ...result, answers: result.answers.map((x, j) => (j === i ? text : x)) });
  const text = result ? `${rouletteText(result)}${learned.trim() ? `\n\nWhat I learned: ${learned.trim()}` : ''}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Who is in the room?" note="Pick two characters from a document, or make up two. Characters from your notes bring their relationship with them.">
        <Row>
          <Chip on={source === 'new'} onClick={() => setSource('new')}>Two new characters</Chip>
          <Chip on={source === 'story'} onClick={() => setSource('story')}>From my story</Chip>
        </Row>
        {source === 'new' ? (
          <Row gap={12} style={{ alignItems: 'flex-end' }}>
            <Label text="Character one" grow><input value={nameA} onChange={e => setNameA(e.target.value)} placeholder="A name" style={field} /></Label>
            <Label text="Character two" grow><input value={nameB} onChange={e => setNameB(e.target.value)} placeholder="A name" style={field} /></Label>
            <button style={btn} onClick={() => { setNameA(randomName()); setNameB(randomName()); }}><Dices size={14} />Make some up</button>
          </Row>
        ) : characters.length < 2 ? (
          <Muted>This document needs at least two characters in its Story Bible. Pick another document, or make up two.</Muted>
        ) : (
          <>
            <Row gap={12} style={{ alignItems: 'flex-end' }}>
              <DocSelect docs={docs} value={docId} onChange={id => { setDocId(id); setIdA(''); setIdB(''); }} />
              <Label text="Character one"><select value={a?.id ?? ''} onChange={e => setIdA(e.target.value)} style={field}>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
              <Label text="Character two"><select value={b?.id ?? ''} onChange={e => setIdB(e.target.value)} style={field}>{characters.filter(c => c.id !== a?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
            </Row>
            <Muted>
              {relation.types.length ? `Their cards say: ${relation.types.map(tagLabel).join(', ')}.` : 'Their cards do not say how they are connected yet.'}
              {relation.notes[0] ? ` "${relation.notes[0]}"` : ''}
            </Muted>
          </>
        )}
      </Panel>

      <Panel title="What kind of pair are they?">
        <Row>
          {ROULETTE_MODES.map(m => (
            <Chip key={m.id} on={mode === m.id} onClick={() => pickMode(m.id)} title={m.hint}>{m.label}{fromStory && suggested === m.id && m.id !== 'any' ? ' (suggested)' : ''}</Chip>
          ))}
        </Row>
        <Muted>{ROULETTE_MODES.find(m => m.id === mode)?.hint}</Muted>
        <Row>
          <button style={btnPrimary} onClick={() => roll()} disabled={!names.a.trim() || !names.b.trim()}><Dices size={14} />{result ? 'Roll again' : 'Roll a situation'}</button>
          {(!names.a.trim() || !names.b.trim()) && <Muted>Name both characters first.</Muted>}
        </Row>
      </Panel>

      {result && (
        <>
          <Panel title="The situation">
            <Story>{result.situation}</Story>
            <Row><button style={btn} onClick={() => setResult({ ...result, situation: rollSituation({ a: result.a, b: result.b, mode: result.mode }, [result.situation]) })}><Shuffle size={14} />Another situation, same questions</button></Row>
          </Panel>

          <Panel title="Questions about the two of them" note="Answer as many as you like, in a word or a paragraph. You are looking for something you did not know.">
            {result.questions.map((q, i) => (
              <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Row wrap={false} style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Story>{q}</Story>
                  <button title="A different question" aria-label="A different question" style={{ ...btn, padding: '4px 7px' }} onClick={() => setResult(rerollQuestion(result, i, relation.types))}><Dices size={14} /></button>
                </Row>
                <textarea aria-label={q} rows={2} value={result.answers[i]} onChange={e => setAnswer(i, e.target.value)} style={area} />
              </div>
            ))}
          </Panel>

          <Panel title="What did you find out?">
            <textarea rows={3} value={learned} onChange={e => setLearned(e.target.value)} placeholder={`One thing about ${result.a} and ${result.b} you did not know before…`} style={area} />
            <KeepBar doc={doc} game="roulette" title={`${result.a} and ${result.b}`} text={text} />
          </Panel>
        </>
      )}
    </div>
  );
};
