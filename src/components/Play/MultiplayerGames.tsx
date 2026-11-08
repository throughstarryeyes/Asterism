import React, { useEffect, useReducer, useState } from 'react';
import type * as Y from 'yjs';
import { Trash2 } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import {
  MODES, addMove, createRoom, deal, getRoom, joinRoom, joined, latestEntries, leaveRoom, listRooms, modeInfo, movesIn, removeRoom, roomTranscript, stillWriting, updateRoom,
  watchGames, whoseTurn, wordCount, type Move, type MoveKind, type MysteryCase, type Room, type RoomMode,
} from '../../services/play/rooms';
import { mysteryChecks } from '../../services/play/mystery';
import { Chip, KeepBar, Label, Muted, Panel, Row, Story, area, btn, btnPrimary, field, useDocs } from './ui';
import { MysteryForm, blankMystery } from './MysteryGame';

const REFLECTIONS = [
  'What did each of you notice that the others did not?',
  'What did someone misunderstand, and what made that easy to do?',
  'What did each person leave out on purpose?',
];

// games played inside a live writing session. everything is kept in the session's shared document, so the host's connection is the only one needed.
export const MultiplayerGames: React.FC = () => {
  const { live, setIsCollabModalOpen } = useAsterism();

  if (live.mode === 'none' || !live.doc) {
    return (
      <Panel title="Multiplayer" note="These games run inside a live writing session, so you play with the people already writing with you.">
        <Muted>Start or join a live session for the document you have open, then come back here. Everyone who can write in the session can play.</Muted>
        <Row><button style={btnPrimary} onClick={() => setIsCollabModalOpen(true)}>Open live sessions</button></Row>
      </Panel>
    );
  }
  if (live.mode === 'ended') {
    return <Panel title="Multiplayer"><Muted>This session has ended, and its games ended with it. Anything you kept is still in your documents.</Muted></Panel>;
  }
  return <Games doc={live.doc} me={live.who.name} canWrite={live.role === 'writer'} people={live.people} />;
};

const Games: React.FC<{ doc: Y.Doc; me: string; canWrite: boolean; people: string[] }> = ({ doc, me, canWrite, people }) => {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => watchGames(doc, tick), [doc]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const room = roomId ? getRoom(doc, roomId) : undefined;

  if (room) return <RoomView doc={doc} room={room} me={me} canWrite={canWrite} people={people} onLeave={() => setRoomId(null)} />;
  return <Lobby doc={doc} me={me} canWrite={canWrite} onOpen={setRoomId} />;
};

// ---- the lobby: games already going, and starting a new one ----

const Lobby: React.FC<{ doc: Y.Doc; me: string; canWrite: boolean; onOpen: (id: string) => void }> = ({ doc, me, canWrite, onOpen }) => {
  const rooms = listRooms(doc);
  const [mode, setMode] = useState<RoomMode>('pass_story');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [limit, setLimit] = useState(0);
  const [mystery, setMystery] = useState<MysteryCase>(blankMystery);
  const info = modeInfo(mode);
  const checks = mode === 'mystery_reveal' ? mysteryChecks(mystery) : [];

  const create = () => {
    const room = createRoom(doc, {
      mode, title, host: me, prompt: prompt.trim() || undefined, wordLimit: mode === 'pass_story' && limit ? limit : undefined,
      mystery: mode === 'mystery_reveal' ? { ...mystery, evidence: mystery.evidence.filter(e => e.text.trim()), suspects: mystery.suspects.filter(s => s.name.trim()) } : undefined,
    });
    setTitle(''); setPrompt('');
    onOpen(room.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Games in this session" note="They live in the session. If the host ends it, the games go too, so keep what you want to keep (every game has a Keep button).">
        {rooms.length === 0 && <Muted>No games yet. Start one below.</Muted>}
        {rooms.map(r => (
          <Row key={r.id} style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <div>
              <Story>{r.title}</Story>
              <Muted>{modeInfo(r.mode).label} · {r.status === 'setup' ? 'gathering players' : r.status === 'playing' ? 'in play' : r.status === 'revealed' ? 'revealed' : 'finished'} · {joined(doc, r.id).join(', ')}</Muted>
            </div>
            <button style={btn} onClick={() => onOpen(r.id)}>Open</button>
          </Row>
        ))}
      </Panel>

      {!canWrite && <Panel><Muted>You are reading along in this session, so you can watch games but not play in them.</Muted></Panel>}

      {canWrite && (
        <Panel title="Start a game">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="radiogroup" aria-label="Game">
            {MODES.map(m => (
              <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
                style={{ ...btn, justifyContent: 'flex-start', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: 2, background: mode === m.id ? 'var(--accent-gold-bg)' : 'transparent', borderColor: mode === m.id ? 'var(--accent-gold)' : 'var(--border-subtle)' }}>
                <span>{m.label}</span>
                <span style={{ fontWeight: 400, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{m.blurb}</span>
              </button>
            ))}
          </div>
          <Label text="Name for this game (optional)"><input value={title} onChange={e => setTitle(e.target.value)} placeholder={info.label} style={field} /></Label>
          {mode !== 'mystery_reveal' && (
            <Label text={mode === 'pass_story' ? 'Opening line or situation (optional)' : 'Prompt or situation (optional)'}>
              <textarea rows={2} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Leave blank to be dealt one" style={area} />
            </Label>
          )}
          {mode === 'pass_story' && (
            <Row>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Words per turn</span>
              {[0, 100, 200, 400].map(n => <Chip key={n} on={limit === n} onClick={() => setLimit(n)}>{n ? `Up to ${n}` : 'No limit'}</Chip>)}
            </Row>
          )}
          {mode === 'mystery_reveal' && (
            <>
              <Muted>You know the answer, and the others will investigate. Whatever you write here is hidden on their screens, but it is carried to every device in the session, so play it as a game and not a vault.</Muted>
              <MysteryForm m={mystery} onChange={setMystery} />
              {checks.length > 0 && <Muted>Things to think about: {checks.join(' ')}</Muted>}
            </>
          )}
          {info.hidden && mode !== 'mystery_reveal' && <Muted>Hidden parts are kept off other players' screens, but they are carried to every device in the session, so play it as a game and not a vault.</Muted>}
          <Row><button style={btnPrimary} onClick={create} disabled={mode === 'mystery_reveal' && (!mystery.incident.trim() || !mystery.culprit.trim())}>Start and invite the others to join</button></Row>
        </Panel>
      )}
    </div>
  );
};

// ---- one game ----

const RoomView: React.FC<{ doc: Y.Doc; room: Room; me: string; canWrite: boolean; people: string[]; onLeave: () => void }> = ({ doc, room, me, canWrite, people, onLeave }) => {
  const { doc: myDoc } = useDocs();
  const players = joined(doc, room.id);
  const moves = movesIn(doc, room.id);
  const info = modeInfo(room.mode);
  const isHost = room.host === me;
  const inGame = players.includes(me);
  const turn = whoseTurn(room, moves);
  const text = roomTranscript(room, moves);
  const mine = room.assignments?.[me];
  const shown = room.status === 'revealed' || room.status === 'done';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title={info.label}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Story>{room.title}</Story>
          <Row>
            <button style={btn} onClick={onLeave}>Back to the games</button>
            {isHost && <button style={btn} aria-label="Delete this game" onClick={() => { if (window.confirm('Delete this game for everyone?')) { removeRoom(doc, room.id); onLeave(); } }}><Trash2 size={14} />Delete</button>}
          </Row>
        </Row>
        <Muted>{info.blurb}</Muted>
        <Muted>
          Players: {players.length ? players.map(p => `${p}${p === room.host ? ' (host)' : ''}${people.includes(p) ? '' : ' (away)'}`).join(', ') : 'nobody yet'}
        </Muted>
        {room.prompt && <Story>{room.prompt}</Story>}
      </Panel>

      {room.status === 'setup' && (
        <Panel title="Gathering players">
          {!inGame && canWrite && <Row><button style={btnPrimary} onClick={() => joinRoom(doc, room.id, me)}>Join this game</button></Row>}
          {inGame && !isHost && <Row><Muted>You are in. Waiting for {room.host} to start.</Muted><button style={btn} onClick={() => leaveRoom(doc, room.id, me)}>Leave</button></Row>}
          {isHost && (
            <>
              <Muted>{players.length < info.min ? `You need at least ${info.min} players. Everyone in the session can join from the Multiplayer page.` : 'When everyone is here, deal the game. People who join later can watch.'}</Muted>
              <Row><button style={btnPrimary} disabled={players.length < info.min} onClick={() => updateRoom(doc, room.id, deal(room, players))}>Start the game</button></Row>
            </>
          )}
          {!inGame && !canWrite && <Muted>Readers can watch but not play.</Muted>}
        </Panel>
      )}

      {room.status !== 'setup' && !inGame && <Panel><Muted>This game started before you joined, so you can watch.</Muted></Panel>}

      {room.status !== 'setup' && mine && (mine.prompt || mine.secret || mine.role) && (
        <Panel title="Yours alone">
          {mine.role && <Story>You are {mine.role}.</Story>}
          {mine.prompt && <Story>Your constraint: {mine.prompt}</Story>}
          {mine.secret && <Story>Your secret ingredient: {mine.secret}</Story>}
          {mine.secret && !shown && <Muted>Work it into the story without giving it away. The others have their own.</Muted>}
        </Panel>
      )}
      {room.mode === 'different_prompts' && room.status !== 'setup' && (
        <Panel title="Everyone's constraints" note="Each writer has a different one. All of it has to fit one story.">
          {(room.order ?? []).map(p => <Muted key={p}><strong>{p}:</strong> {room.assignments?.[p]?.prompt}</Muted>)}
        </Panel>
      )}

      {room.status !== 'setup' && (
        <>
          {(room.mode === 'same_prompt' || room.mode === 'two_perspectives') && <Simultaneous doc={doc} room={room} me={me} moves={moves} canPlay={canWrite && inGame} />}
          {(room.mode === 'pass_story' || room.mode === 'different_prompts' || room.mode === 'secret_ingredient') && <SharedStory doc={doc} room={room} me={me} moves={moves} turn={turn} canPlay={canWrite && inGame} />}
          {room.mode === 'correspondence' && <Letters doc={doc} room={room} me={me} moves={moves} turn={turn} canPlay={canWrite && inGame} />}
          {room.mode === 'mystery_build' && <Building doc={doc} room={room} me={me} moves={moves} turn={turn} canPlay={canWrite && inGame} />}
          {room.mode === 'mystery_reveal' && <Investigation doc={doc} room={room} me={me} moves={moves} isHost={isHost} canPlay={canWrite && inGame} />}
        </>
      )}

      {room.status === 'revealed' && room.mode === 'two_perspectives' && (
        <Panel title="Compare" note="Read them side by side, then talk about it.">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{REFLECTIONS.map(r => <li key={r}>{r}</li>)}</ul>
        </Panel>
      )}

      {isHost && room.status === 'playing' && room.mode !== 'same_prompt' && room.mode !== 'two_perspectives' && room.mode !== 'mystery_reveal' && (
        <Panel title="Finish the game">
          <Muted>{room.mode === 'secret_ingredient' ? 'Finishing reveals everyone\'s secret ingredient, and the guesses.' : 'Finishing closes the game. You can still keep what was written.'}</Muted>
          <Row><button style={btn} onClick={() => updateRoom(doc, room.id, { status: room.mode === 'secret_ingredient' ? 'revealed' : 'done' })}>{room.mode === 'secret_ingredient' ? 'Finish and reveal' : 'Finish'}</button></Row>
        </Panel>
      )}
      {isHost && room.status === 'revealed' && room.mode !== 'mystery_reveal' && (
        <Row><button style={btn} onClick={() => updateRoom(doc, room.id, { status: 'done' })}>Close the game</button></Row>
      )}

      {inGame && room.status !== 'setup' && (
        <Panel title="Keep it" note="Saves your copy of the whole game, in your own document. Nobody else's copy changes.">
          <KeepBar doc={myDoc} game="multiplayer" title={room.title} text={text} />
        </Panel>
      )}
    </div>
  );
};

interface PartProps { doc: Y.Doc; room: Room; me: string; moves: Move[]; canPlay: boolean }
interface TurnProps extends PartProps { turn: string | undefined }

const who = (m: Move) => <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{m.by}{m.as ? `, as ${m.as}` : ''}</span>;

// everyone writes alone, and nothing is shown until everyone is done
const Simultaneous: React.FC<PartProps> = ({ doc, room, me, moves, canPlay }) => {
  const entries = latestEntries(moves);
  const mineNow = entries.find(e => e.by === me);
  const [text, setText] = useState(mineNow?.text ?? '');
  const left = stillWriting(room, moves);
  const revealed = room.status === 'revealed' || room.status === 'done';
  const isHost = room.host === me;

  return (
    <>
      {!revealed && canPlay && (
        <Panel title="Your writing">
          <textarea aria-label="Your writing" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder="Write on your own. Nobody sees it until everyone is done." style={area} />
          <Row>
            <button style={btnPrimary} disabled={!text.trim()} onClick={() => addMove(doc, { room: room.id, kind: 'entry', by: me, text: text.trim() })}>{mineNow ? 'Update what I handed in' : 'Hand it in'}</button>
            <Muted>{wordCount(text)} words{mineNow ? ' · handed in' : ''}</Muted>
          </Row>
        </Panel>
      )}
      {!revealed && (
        <Panel title="Waiting">
          <Muted>{left.length ? `Still writing: ${left.join(', ')}.` : 'Everyone has handed something in.'}</Muted>
          <Row>
            {(left.length === 0 || isHost) && <button style={left.length ? btn : btnPrimary} onClick={() => updateRoom(doc, room.id, { status: 'revealed' })}>{left.length ? 'Reveal now anyway' : 'Reveal everyone\'s writing'}</button>}
          </Row>
        </Panel>
      )}
      {revealed && entries.map(e => (
        <Panel key={e.id} title={`${e.by}${room.assignments?.[e.by]?.role ? `, as ${room.assignments[e.by].role}` : ''}`}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{e.text}</p>
        </Panel>
      ))}
      {revealed && entries.length === 0 && <Panel><Muted>Nobody handed anything in.</Muted></Panel>}
    </>
  );
};

// a shared story, written a turn at a time (or freely, in the games with private parts)
const SharedStory: React.FC<TurnProps> = ({ doc, room, me, moves, turn, canPlay }) => {
  const [text, setText] = useState('');
  const [guess, setGuess] = useState('');
  const turns = moves.filter(m => m.kind === 'turn');
  const strict = room.mode === 'pass_story';
  const myTurn = !strict || turn === me;
  const limit = room.wordLimit ?? 0;
  const over = limit > 0 && wordCount(text) > limit;
  const finished = room.status === 'revealed' || room.status === 'done';
  const guesses = moves.filter(m => m.kind === 'guess');

  const send = (kind: MoveKind, body: string) => { addMove(doc, { room: room.id, kind, by: me, text: body }); setText(''); };

  return (
    <>
      <Panel title="The story so far">
        {turns.length === 0 && <Muted>{strict ? `${turn ?? room.host} opens the story.` : 'Nobody has written yet. Start whenever you like.'}</Muted>}
        {turns.map(m => <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{who(m)}<p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.text}</p></div>)}
      </Panel>
      {!finished && canPlay && (
        <Panel title={myTurn ? (strict ? 'Your turn' : 'Add to the story') : 'Waiting'}>
          {!myTurn && <Muted>It is {turn}'s turn. You will see the story grow here.</Muted>}
          {myTurn && (
            <>
              <textarea aria-label="Your part of the story" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={turns.length ? 'Pick up where it left off…' : 'Open the story…'} style={area} />
              <Row>
                <button style={btnPrimary} disabled={!text.trim() || over} onClick={() => send('turn', text.trim())}>Add it</button>
                {strict && turns.length > 0 && <button style={btn} onClick={() => send('pass', '')}>Pass</button>}
                <Muted>{wordCount(text)}{limit ? ` of ${limit}` : ''} words{over ? ' (too long)' : ''}</Muted>
              </Row>
            </>
          )}
        </Panel>
      )}
      {room.mode === 'secret_ingredient' && !finished && canPlay && (
        <Panel title="Guess the ingredients" note="Think you spotted someone's? Say so. Guesses are shown at the end.">
          <Row>
            <input aria-label="Your guess" value={guess} onChange={e => setGuess(e.target.value)} placeholder="I think Sam had to…" style={{ ...field, flex: 1 }} />
            <button style={btn} disabled={!guess.trim()} onClick={() => { addMove(doc, { room: room.id, kind: 'guess', by: me, text: guess.trim() }); setGuess(''); }}>Add a guess</button>
          </Row>
          <Muted>{guesses.filter(g => g.by === me).length} guess{guesses.filter(g => g.by === me).length === 1 ? '' : 'es'} so far.</Muted>
        </Panel>
      )}
      {room.mode === 'secret_ingredient' && finished && (
        <Panel title="The secret ingredients">
          {(room.order ?? []).map(p => <Muted key={p}><strong>{p}:</strong> {room.assignments?.[p]?.secret}</Muted>)}
          {guesses.map(g => <Muted key={g.id}>{g.by} guessed: {g.text}</Muted>)}
        </Panel>
      )}
    </>
  );
};

// letters between characters, one at a time, whether or not anyone else is online
const Letters: React.FC<TurnProps> = ({ doc, room, me, moves, turn, canPlay }) => {
  const letters = moves.filter(m => m.kind === 'letter');
  const lastAs = [...letters].reverse().find(l => l.by === me)?.as ?? '';
  const [as, setAs] = useState(lastAs);
  const [text, setText] = useState('');
  const finished = room.status === 'done';
  const myTurn = turn === me;
  return (
    <>
      <Panel title="The letters" note="An exchange can run for days. Come back when it is your turn.">
        {letters.length === 0 && <Muted>{turn ?? room.host} writes first.</Muted>}
        {letters.map(l => (
          <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            {who(l)}
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.65, fontFamily: 'var(--font-title)' }}>{l.text}</p>
          </div>
        ))}
      </Panel>
      {!finished && canPlay && (
        <Panel title={myTurn ? 'Write your letter' : 'Waiting for a reply'}>
          {!myTurn && <Muted>It is {turn}'s turn to write.</Muted>}
          {myTurn && (
            <>
              <Label text={`Writing as${room.assignments?.[me]?.role ? ` (you are ${room.assignments[me].role})` : ''}`}><input value={as} onChange={e => setAs(e.target.value)} placeholder="Your character's name" style={{ ...field, maxWidth: 280 }} /></Label>
              <textarea aria-label="Your letter" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder="Dear…" style={area} />
              <Row><button style={btnPrimary} disabled={!text.trim() || !as.trim()} onClick={() => { addMove(doc, { room: room.id, kind: 'letter', by: me, as: as.trim(), text: text.trim() }); setText(''); }}>Send the letter</button></Row>
            </>
          )}
        </Panel>
      )}
    </>
  );
};

const FACTS = ['Suspect', 'Clue', 'Complication', 'Fact'];

// a mystery made a piece at a time, nobody knowing where it ends
const Building: React.FC<TurnProps> = ({ doc, room, me, moves, turn, canPlay }) => {
  const [as, setAs] = useState(FACTS[1]);
  const [text, setText] = useState('');
  const facts = moves.filter(m => m.kind === 'fact');
  const finished = room.status === 'done';
  const myTurn = turn === me;
  return (
    <>
      <Panel title="The case so far">
        {facts.length === 0 && <Muted>{turn ?? room.host} adds the first piece.</Muted>}
        {FACTS.map(k => {
          const of = facts.filter(f => f.as === k);
          return of.length ? (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{k}s</span>
              {of.map(f => <p key={f.id} style={{ margin: 0, lineHeight: 1.55 }}>{f.text} <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>({f.by})</span></p>)}
            </div>
          ) : null;
        })}
      </Panel>
      {!finished && canPlay && (
        <Panel title={myTurn ? 'Your turn' : 'Waiting'}>
          {!myTurn && <Muted>It is {turn}'s turn to add something.</Muted>}
          {myTurn && (
            <>
              <Row>{FACTS.map(f => <Chip key={f} on={as === f} onClick={() => setAs(f)}>{f}</Chip>)}</Row>
              <textarea aria-label="What you add" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Add a suspect, a clue, a complication, or a fact…" style={area} />
              <Row>
                <button style={btnPrimary} disabled={!text.trim()} onClick={() => { addMove(doc, { room: room.id, kind: 'fact', by: me, as, text: text.trim() }); setText(''); }}>Add it</button>
                {facts.length > 0 && <button style={btn} onClick={() => addMove(doc, { room: room.id, kind: 'pass', by: me, text: '' })}>Pass</button>}
              </Row>
            </>
          )}
        </Panel>
      )}
    </>
  );
};

// one writer built the case and knows the answer, the others ask, look and accuse
const Investigation: React.FC<PartProps & { isHost: boolean }> = ({ doc, room, me, moves, isHost, canPlay }) => {
  const my = room.mystery;
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({});
  if (!my) return <Panel><Muted>This game has no case.</Muted></Panel>;
  const finished = room.status === 'revealed' || room.status === 'done';
  const questions = moves.filter(m => m.kind === 'question');
  const answerTo = (id: string) => moves.find(m => m.kind === 'answer' && m.re === id);
  const accusations = moves.filter(m => m.kind === 'accuse');
  const deductions = moves.filter(m => m.kind === 'deduction');
  const setShown = (id: string, shown: boolean) => updateRoom(doc, room.id, { mystery: { ...my, evidence: my.evidence.map(e => (e.id === id ? { ...e, shown } : e)) } });

  return (
    <>
      <Panel title={my.title || 'The case'}>
        <Story>{my.incident}</Story>
        <Muted>Suspects</Muted>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{my.suspects.map(s => <li key={s.name}><strong>{s.name}</strong>{s.role ? `, ${s.role}` : ''}</li>)}</ul>
      </Panel>

      <Panel title="Evidence" note={isHost ? 'You decide what the investigators have found. Show a clue when they earn it.' : undefined}>
        {my.evidence.filter(e => isHost || e.shown || finished).length === 0 && <Muted>Nothing has been found yet. Ask {room.host} questions.</Muted>}
        {my.evidence.filter(e => isHost || e.shown || finished).map(e => (
          <Row key={e.id} wrap={false} style={{ justifyContent: 'space-between' }}>
            <p style={{ margin: 0, lineHeight: 1.55, opacity: e.shown || finished ? 1 : 0.6 }}>{e.text}</p>
            {isHost && !finished && <button style={btn} onClick={() => setShown(e.id, !e.shown)}>{e.shown ? 'Hide' : 'Show'}</button>}
          </Row>
        ))}
      </Panel>

      <Panel title="Questions">
        {questions.length === 0 && <Muted>No questions yet.</Muted>}
        {questions.map(m => {
          const a = answerTo(m.id);
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
              {who(m)}
              <p style={{ margin: 0 }}>{m.text}</p>
              {a && <p style={{ margin: 0, fontStyle: 'italic' }}>{a.text}</p>}
              {isHost && !a && (
                <Row>
                  <input aria-label="Your answer" value={reply[m.id] ?? ''} onChange={e => setReply({ ...reply, [m.id]: e.target.value })} placeholder="Your answer" style={{ ...field, flex: 1 }} />
                  <button style={btn} disabled={!(reply[m.id] ?? '').trim()} onClick={() => { addMove(doc, { room: room.id, kind: 'answer', by: me, re: m.id, text: reply[m.id].trim() }); setReply({ ...reply, [m.id]: '' }); }}>Answer</button>
                </Row>
              )}
            </div>
          );
        })}
        {!isHost && !finished && canPlay && (
          <Row>
            <input aria-label="Ask a question" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { addMove(doc, { room: room.id, kind: 'question', by: me, text: q.trim() }); setQ(''); } }} placeholder={`Ask ${room.host} something`} style={{ ...field, flex: 1 }} />
            <button style={btn} disabled={!q.trim()} onClick={() => { addMove(doc, { room: room.id, kind: 'question', by: me, text: q.trim() }); setQ(''); }}>Ask</button>
          </Row>
        )}
      </Panel>

      {!isHost && !finished && canPlay && (
        <Panel title="Your deductions">
          {deductions.filter(d => d.by === me).map(d => <Muted key={d.id}>{d.text}</Muted>)}
          <Row>
            <input aria-label="A deduction" value={note} onChange={e => setNote(e.target.value)} placeholder="Something you have worked out" style={{ ...field, flex: 1 }} />
            <button style={btn} disabled={!note.trim()} onClick={() => { addMove(doc, { room: room.id, kind: 'deduction', by: me, text: note.trim() }); setNote(''); }}>Note it</button>
          </Row>
          <Muted>Accuse someone when you are ready. You can accuse more than once.</Muted>
          <Row>{my.suspects.map(s => <button key={s.name} style={btn} onClick={() => addMove(doc, { room: room.id, kind: 'accuse', by: me, text: s.name })}>Accuse {s.name}</button>)}</Row>
        </Panel>
      )}

      {accusations.length > 0 && (
        <Panel title="Accusations">
          {accusations.map(a => <Muted key={a.id}>{a.by} accuses {a.text}.{finished ? (a.text.trim().toLowerCase() === my.culprit.trim().toLowerCase() ? ' Correct.' : ' Not them.') : ''}</Muted>)}
        </Panel>
      )}

      {isHost && !finished && (
        <Panel title="The answer" note="Only you can see this until you reveal it.">
          <Muted>It was {my.culprit}. {my.how}</Muted>
          <Row><button style={btnPrimary} onClick={() => updateRoom(doc, room.id, { status: 'revealed' })}>Reveal the answer</button></Row>
        </Panel>
      )}
      {finished && <Panel title="The answer"><Story>It was {my.culprit}. {my.how}</Story></Panel>}
    </>
  );
};
