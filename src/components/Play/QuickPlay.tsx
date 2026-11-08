import React, { useEffect, useRef, useState } from 'react';
import { Dices } from 'lucide-react';
import * as muse from '../../services/muse/generators';
import { wordCount } from '../../services/play/rooms';
import { Chip, KeepBar, Muted, Panel, Row, Story, area, btn, btnPrimary, useDocs } from './ui';

type Quick = 'words' | 'six' | 'oneliner' | 'prompt' | 'exercise';

const GAMES: Array<{ id: Quick; label: string; hint: string; seconds: number }> = [
  { id: 'words', label: 'Three words', hint: 'Use all three in one short piece.', seconds: 300 },
  { id: 'six', label: 'Six-word story', hint: 'A whole story in exactly six words.', seconds: 120 },
  { id: 'oneliner', label: 'One-liner', hint: 'A single line to open, close or break a scene.', seconds: 180 },
  { id: 'prompt', label: 'Warm-up prompt', hint: 'A short prompt and a few minutes.', seconds: 300 },
  { id: 'exercise', label: 'Exercise', hint: 'A craft exercise with a constraint.', seconds: 300 },
];

const roll = (id: Quick): { heading?: string; text: string } => {
  switch (id) {
    case 'words': return { text: muse.pickMany(muse.WORDS, 3).join(' · ') };
    case 'six': return { heading: 'Exactly six words', text: `Theme: ${muse.pick(muse.WORDS) ?? 'tide'}` };
    case 'oneliner': { const r = muse.randomOneLiner(); return { heading: r?.tag, text: r?.text ?? '' }; }
    case 'prompt': return { text: muse.pick(muse.PROMPTS) ?? '' };
    case 'exercise': {
      const r = muse.randomExercise();
      return { heading: r?.exercise.name, text: [r?.exercise.instruction, r?.exercise.constraint && `Constraint: ${r.exercise.constraint}`].filter(Boolean).join(' ') };
    }
  }
};

// short warm-ups: roll something, set a timer, write
export const QuickPlay: React.FC = () => {
  const { doc } = useDocs();
  const [game, setGame] = useState<Quick>('words');
  const [card, setCard] = useState(() => roll('words'));
  const [text, setText] = useState('');
  const info = GAMES.find(g => g.id === game)!;
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);
  const stop = () => { window.clearInterval(timer.current); setLeft(null); };
  const start = () => {
    window.clearInterval(timer.current);
    setLeft(info.seconds);
    timer.current = window.setInterval(() => setLeft(s => {
      if (s === null || s <= 1) { window.clearInterval(timer.current); return 0; }
      return s - 1;
    }), 1000);
  };
  const pickGame = (id: Quick) => { stop(); setGame(id); setCard(roll(id)); setText(''); };
  const again = () => { stop(); setCard(roll(game)); setText(''); };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const words = wordCount(text);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Quick play" note="Warm-ups and word games. A timer is there if you want one, and nothing is graded.">
        <Row>{GAMES.map(g => <Chip key={g.id} on={g.id === game} onClick={() => pickGame(g.id)} title={g.hint}>{g.label}</Chip>)}</Row>
        <Muted>{info.hint}</Muted>
      </Panel>
      <Panel title={card.heading ?? info.label}>
        <Story>{card.text}</Story>
        <Row>
          <button style={btn} onClick={again}><Dices size={14} />Another</button>
          {left === null ? <button style={btnPrimary} onClick={start}>Start a {mmss(info.seconds)} timer</button> : <button style={btn} onClick={stop}>Stop the timer</button>}
          {left !== null && <span role="timer" aria-live="off" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{left === 0 ? 'Time. Finish your sentence.' : mmss(left)}</span>}
        </Row>
      </Panel>
      <Panel>
        <textarea aria-label="Your writing" rows={game === 'six' ? 2 : 8} value={text} onChange={e => setText(e.target.value)} placeholder="Write here…" style={area} />
        <Muted>{game === 'six' ? (words === 6 ? 'Six words.' : `${words} word${words === 1 ? '' : 's'}. Aim for exactly six.`) : `${words} word${words === 1 ? '' : 's'}`}</Muted>
        <KeepBar doc={doc} game="quick" title={`${info.label}: ${card.text.slice(0, 30)}`} text={`${card.text}\n\n${text}`} disabled={!text.trim()} />
      </Panel>
    </div>
  );
};
