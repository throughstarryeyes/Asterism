import React, { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { useNarrow } from '../Common/useNarrow';
import { withoutSavedNote } from '../../services/play/save';
import { AdventureGame } from './AdventureGame';
import { CharacterLab } from './CharacterLab';
import { MissingSceneGame } from './MissingSceneGame';
import { MultiplayerGames } from './MultiplayerGames';
import { MysteryGame } from './MysteryGame';
import { QuickPlay } from './QuickPlay';
import { RouletteGame } from './RouletteGame';
import { DocSelect, Muted, Panel, Row, Story, btn, useDocs } from './ui';

type GameKey = 'home' | 'quick' | 'lab' | 'roulette' | 'missing' | 'adventure' | 'multiplayer' | 'mystery' | 'kept';

interface Game { key: GameKey; label: string; blurb: string }
interface Collection { name: string; games: Game[] }

const COLLECTIONS: Collection[] = [
  { name: 'Quick Play', games: [{ key: 'quick', label: 'Warm-ups', blurb: 'Word games and short prompts, with a timer if you want one.' }] },
  { name: 'Character Lab', games: [{ key: 'lab', label: 'Character Lab', blurb: 'Put a character in a situation, then change it and see what holds.' }] },
  {
    name: 'Story Games',
    games: [
      { key: 'roulette', label: 'Relationship Roulette', blurb: 'Two characters, a situation that forces them together, and questions about the pair.' },
      { key: 'missing', label: 'Missing Scene', blurb: 'Moments your story has set up but not shown.' },
    ],
  },
  { name: 'Solo Adventures', games: [{ key: 'adventure', label: 'Roll Your Story', blurb: 'Dice, tables and an oracle build a story you did not plan.' }] },
  { name: 'Multiplayer', games: [{ key: 'multiplayer', label: 'Writing together', blurb: 'Pass the story, letters, shared prompts and secret ingredients, inside a live session.' }] },
  { name: 'Mysteries', games: [{ key: 'mystery', label: 'Mystery Builder', blurb: 'Solve a generated case, or build one of your own.' }] },
];

const TITLES: Record<GameKey, string> = {
  home: 'Play', quick: 'Warm-ups', lab: 'Character Lab', roulette: 'Relationship Roulette', missing: 'Missing Scene', adventure: 'Roll Your Story',
  multiplayer: 'Writing together', mystery: 'Mystery Builder', kept: 'Kept from Play',
};

// Play: games that help you write, and that can feed what you are writing
export const PlayView: React.FC = () => {
  const { setViewMode } = useAsterism();
  const narrow = useNarrow();
  const [game, setGame] = useState<GameKey>('home');

  const navButton = (key: GameKey, label: string) => (
    <button key={key} onClick={() => setGame(key)} aria-current={game === key ? 'page' : undefined}
      style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem', cursor: 'pointer', fontWeight: game === key ? 600 : 500, background: game === key ? 'var(--bg-paper)' : 'transparent', color: game === key ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)', border: 'none', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', width: '100%', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', overflow: 'hidden' }}>
      <header style={{ height: '56px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', display: 'flex', alignItems: 'center', gap: '14px', padding: '0 20px', flexShrink: 0 }}>
        <button onClick={() => setViewMode('standard')} style={btn}><ArrowLeft size={15} /><span>Back</span></button>
        <h1 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-title)', margin: 0 }}>{TITLES[game]}</h1>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', minHeight: 0 }}>
        <nav aria-label="Play" style={narrow
          ? { display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }
          : { width: '220px', borderRight: '1px solid var(--border-subtle)', padding: '14px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flexShrink: 0 }}>
          {navButton('home', 'Play home')}
          {COLLECTIONS.map(c => narrow
            ? c.games.map(g => navButton(g.key, g.label))
            : (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 10px 4px' }}>{c.name}</div>
                {c.games.map(g => navButton(g.key, g.label))}
              </div>
            ))}
          {navButton('kept', 'Kept from Play')}
        </nav>

        <main style={{ flex: 1, overflowY: 'auto', padding: narrow ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ maxWidth: 860, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {game === 'home' && <Home onPick={setGame} />}
            {game === 'quick' && <QuickPlay />}
            {game === 'lab' && <CharacterLab />}
            {game === 'roulette' && <RouletteGame />}
            {game === 'missing' && <MissingSceneGame />}
            {game === 'adventure' && <AdventureGame />}
            {game === 'multiplayer' && <MultiplayerGames />}
            {game === 'mystery' && <MysteryGame />}
            {game === 'kept' && <Kept />}
          </div>
        </main>
      </div>
    </div>
  );
};

const Home: React.FC<{ onPick: (g: GameKey) => void }> = ({ onPick }) => (
  <>
    <Panel>
      <Story>Games that help you write.</Story>
      <Muted>Everything here runs on your device and works offline. Nothing is generated by AI: the situations, questions and clues come from tables and your own notes. What you keep goes into your documents, and playing earns a few Quill Points a day.</Muted>
    </Panel>
    {COLLECTIONS.map(c => (
      <Panel key={c.name} title={c.name}>
        {c.games.map(g => (
          <Row key={g.key} style={{ justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Story>{g.label}</Story>
              <Muted>{g.blurb}</Muted>
            </div>
            <button style={btn} onClick={() => onPick(g.key)}>Play</button>
          </Row>
        ))}
      </Panel>
    ))}
  </>
);

// what the writer kept from games, per document
const Kept: React.FC = () => {
  const { updateAnyProject, showToast } = useAsterism();
  const { docs, doc, docId, setDocId } = useDocs();
  const saved = [...(doc?.play?.saved ?? [])].reverse();
  return (
    <>
      <Panel title="Kept from Play" note="Notes saved from games. Scenes you wrote stay under Missing Scene until you add them to the manuscript.">
        <DocSelect docs={docs} value={docId} onChange={setDocId} />
      </Panel>
      {saved.length === 0 && <Panel><Muted>Nothing kept in this document yet.</Muted></Panel>}
      {saved.map(n => (
        <Panel key={n.id} title={new Date(n.at).toLocaleDateString()}>
          <Row wrap={false} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Story>{n.title}</Story>
            <Row gap={6} wrap={false}>
              <button style={btn} onClick={() => { void navigator.clipboard?.writeText(n.text).then(() => showToast('Copied.', 'info'), () => undefined); }}>Copy</button>
              <button style={btn} aria-label="Remove this note" onClick={() => doc && updateAnyProject(doc.id, withoutSavedNote(doc, n.id))}><Trash2 size={14} /></button>
            </Row>
          </Row>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.88rem', lineHeight: 1.55 }}>{n.text}</p>
        </Panel>
      ))}
    </>
  );
};
