import React, { useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { readStory } from '../../services/analysisClient';
import { findEntityGaps } from '../../services/coach/entities';
import { contentWords, detectSignals, summarizeSignals } from '../../services/coach/signals';
import { CUE_MODES, CUE_MODE_LABELS, addCue, cueRegex, getDefaultKnowledge, type CoachKnowledge, type CueMode } from '../../services/coach/knowledge';
import { KnowledgeEditor } from './KnowledgeEditor';
import { buildConfirmationPrompt, deletePattern, dismissNudge, forgetExample, recordFeedback, shouldAsk } from '../../services/coach/learning';
import { normalizeCoachMemory, type FeedbackVerdict, type Signal } from '../../services/coach/types';
import { COACH_FEATURES, defaultCoachSettings, isCoachFeatureOn, type CoachFeatureKey } from '../../services/coach/settings';
import {
  actingStrange, advanceChain, castSpark, echoPrompts, findOpenQuestions, nextSceneIdeas, promiseBoard,
  relationshipWeather, resurfaceQuestions, unseenScenes, weatherNudges, whyChainNudges, yourTells, type CastSpark, type Nudge,
} from '../../services/coach/features';
import { MUSE_FOUNDATION_CARDS } from '../../data/museFoundations';
import { getEffectiveLexicon } from '../../data/defaultStoryLexicon';
import { PassageLink } from '../Common/PassageLink';
import { Loader } from '../Common/Loader';
import { useDeferred } from '../Common/useDeferred';
import { RuleActions, TeachPanel } from './TeachPanel';
import { evaluateRules, listSentences, ruleNudges, stem, type RuleFinding, type Taught } from '../../services/coach/teach';
import { commentTextFor } from '../../services/passageSearch';

const RESPONSES: Array<{ verdict: FeedbackVerdict; label: string }> = [
  { verdict: 'confirm', label: 'Yes, that’s right' },
  { verdict: 'partial', label: 'Partly' },
  { verdict: 'reject', label: 'Not what I meant' },
  { verdict: 'not_yet', label: 'Reader shouldn’t know yet' },
  { verdict: 'intentional', label: 'Intentional' },
  { verdict: 'exception', label: 'Don’t learn from this' },
];

const card: React.CSSProperties = {
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)',
  padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
};
const small: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 };
const heading: React.CSSProperties = { fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' };
const linkBtn: React.CSSProperties = { ...small, textAlign: 'left', textDecoration: 'underline' };
const pill: React.CSSProperties = { padding: '4px 8px', fontSize: '0.74rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)' };

// after the writer answers "is Mara afraid?", offer the words in that sentence so the
// ones that show it can be added to what the coach looks for.
const GrowCues: React.FC<{
  sentence: string;
  names: string[];
  kind: string;
  defaultMode: string;
  knowledge: CoachKnowledge;
  onChange: (k: CoachKnowledge) => void;
}> = ({ sentence, names, kind, defaultMode, knowledge, onChange }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CueMode>((CUE_MODES as string[]).includes(defaultMode) ? (defaultMode as CueMode) : 'physical');
  const existing = Object.values(knowledge.feelings[kind]?.cues ?? {}).flat();
  const words = contentWords(sentence, names).filter(w => !existing.some(c => cueRegex(c).test(w))).slice(0, 14);
  if (!knowledge.feelings[kind] || !words.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={() => setOpen(v => !v)} style={{ ...small, textAlign: 'left', textDecoration: 'underline' }}>
        {open ? 'Hide words' : `Teach me which words show ${knowledge.feelings[kind].label.toLowerCase()}`}
      </button>
      {open && (
        <>
          <div style={small}>Tap a word to add it to what I look for. It applies in every project.</div>
          <select value={mode} onChange={e => setMode(e.target.value as CueMode)} style={{ ...small, alignSelf: 'flex-start', padding: '3px 6px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
            {CUE_MODES.map(m => <option key={m} value={m}>{CUE_MODE_LABELS[m]}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {words.map(w => (
              <button key={w} style={pill} onClick={() => onChange(addCue(knowledge, kind, mode, stem(w)))}>+ {w}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const CoachPanel: React.FC = () => {
  const { project, userStats, activeChapterId, updateProject, setCoachSettings, setCoachKnowledge, dismissLoop, trackLoopAsThread, setSidebarTab, setIsSprintModalOpen, setSprintPresetPrompt, setViewMode } = useAsterism();
  const knowledge = userStats.coachKnowledge ?? getDefaultKnowledge();
  const settings = userStats.coach ?? defaultCoachSettings();
  const memory = useMemo(() => normalizeCoachMemory(project.coachMemory, project.id), [project.coachMemory, project.id]);
  // the analyzer's lexicon tab (mystery questions, commitment phrases) feeds the promise board too.
  const lexicon = useMemo(() => getEffectiveLexicon(project.memoryVault), [project.memoryVault]);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showLearned, setShowLearned] = useState(false);
  const [spark, setSpark] = useState<CastSpark | null>(null);
  const on = (key: CoachFeatureKey) => isCoachFeatureOn(settings, key);

  // reading a long story takes a few seconds, so the panel opens first and the reading follows
  const { value: analysis, pending } = useDeferred(async () => {
    if (!settings.enabled) return null;
    // the same scenes and the same people the analyzer scan works from, read on a background worker
    const { coachUnits: units, index } = await readStory({ chapters: project.chapters, storyBible: project.storyBible, draftMode: project.draftMode, memoryVault: project.memoryVault });
    const signals = detectSignals(units, index, memory, knowledge);
    const focusUnit = Math.max(0, units.findIndex(u => u.chapterId === activeChapterId));
    const sentences = listSentences(units, index.entities.flatMap(e => [e.canonical, ...e.aliases]));
    return { units, index, signals, sentences, summaries: summarizeSignals(signals), focusUnit };
  }, [project.chapters, project.storyBible, project.draftMode, project.memoryVault, memory, settings.enabled, activeChapterId, knowledge], { enabled: settings.enabled });

  // everything below is computed only when its switch is on.
  const feed = useMemo(() => {
    if (!analysis) return null;
    const { units, index, signals, focusUnit } = analysis;
    const ruleFindings: RuleFinding[] = on('storyRules') ? evaluateRules(memory.taught, analysis.sentences, memory.story.dismissed) : [];
    const questions = on('askLater') || on('promiseBoard') ? findOpenQuestions(units, index) : [];
    const gaps = on('whosMissing') || on('nextSceneMenu') ? findEntityGaps(index) : [];
    const unseen = on('unseenScenes') || on('nextSceneMenu') ? unseenScenes(units, memory, knowledge) : [];
    const board = on('promiseBoard') || on('nextSceneMenu') ? promiseBoard(units, index, memory, knowledge, lexicon) : [];
    return {
      ruleFindings,
      rules: ruleNudges(memory.taught, ruleFindings),
      gaps,
      unseen,
      board,
      askLater: on('askLater') ? resurfaceQuestions(questions, units, index, focusUnit, memory) : [],
      echo: on('echoPrompts') ? echoPrompts(units, index, memory) : [],
      why: on('whyChains') ? whyChainNudges(memory, index, knowledge) : [],
      strange: on('actingStrange') ? actingStrange(signals, index, memory, knowledge) : [],
      weather: on('relationshipWeather') ? weatherNudges(relationshipWeather(units, index, knowledge), memory) : [],
      tells: on('yourTells') ? yourTells(units, index) : null,
      scenes: on('nextSceneMenu') ? nextSceneIdeas(board, gaps, unseen) : [],
    };
    // `on` reads settings; list its inputs explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, memory, settings, knowledge, lexicon]);

  const nameOf = (id: string) => analysis?.index.entities.find(e => e.id === id)?.canonical ?? 'Someone';
  const entityNames = analysis?.index.entities.flatMap(e => [e.canonical, ...e.aliases]) ?? [];
  const save = (next: typeof memory) => updateProject({ coachMemory: next });

  const respond = (signal: Signal, verdict: FeedbackVerdict, key: string) => {
    save(recordFeedback(memory, signal, verdict, { explanation: explanations[key]?.trim() || undefined, learningEnabled: settings.learning, entityNames }));
    setExplanations(prev => ({ ...prev, [key]: '' }));
  };
  const toggleFeature = (key: CoachFeatureKey) => setCoachSettings({ ...settings, features: { ...settings.features, [key]: !settings.features[key] } });
  const cardTitle = (id?: string) => (id ? MUSE_FOUNDATION_CARDS.find(c => c.id === id)?.title : undefined);

  const startSprint = (text: string) => {
    setSprintPresetPrompt(text);
    setIsSprintModalOpen(true);
    setViewMode('standard');
  };

  const NudgeCard = ({ n, extra, hideDismiss }: { n: Nudge; extra?: React.ReactNode; hideDismiss?: boolean }) => (
    <div style={card}>
      <div style={heading}>{n.title}</div>
      <div style={small}>{n.body}</div>
      {n.evidence.map((ev, i) => <PassageLink key={i} chapterId={ev.chapterId} quote={ev.sentence} where={ev.unitTitle} commentText={commentTextFor(n.title, n.body)} />)}
      {cardTitle(n.cardId) && <div style={small}>Related card: {cardTitle(n.cardId)}</div>}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {extra}
        {!hideDismiss && <button style={pill} onClick={() => (n.feature === 'askLater' ? dismissLoop(`board-${n.id.slice('ask-'.length)}`) : save(dismissNudge(memory, n.id)))}>Not now</button>}
      </div>
    </div>
  );

  const questions = (analysis?.summaries ?? []).filter(s => on('characterLedger') && shouldAsk(s, memory)).slice(0, 4);
  const worthALook = feed ? [...feed.rules, ...feed.askLater, ...feed.echo, ...feed.strange, ...feed.weather, ...feed.unseen] : [];
  const saveTaught = (taught: Taught) => save({ ...memory, taught });
  const gaps = feed && on('whosMissing') ? feed.gaps.slice(0, 6) : [];
  const nothing = !!analysis && questions.length === 0 && gaps.length === 0 && worthALook.length === 0 && !(feed?.why.length) && !(feed?.board.length) && !(feed?.scenes.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', height: '100%', paddingRight: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Writing coach
          {analysis && pending && <span title="Catching up with your latest changes" style={{ display: 'inline-flex' }}><Loader inline /></span>}
        </div>
        <label style={{ ...small, display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.enabled} onChange={() => setCoachSettings({ ...settings, enabled: !settings.enabled })} />
          On
        </label>
      </div>

      {settings.enabled && !analysis && <Loader message="Reading your story…" />}
      {!settings.enabled && <p style={small}>The coach is off. Nothing is being analyzed or suggested.</p>}
      {nothing && <p style={small}>Nothing to ask yet. Keep writing, and I’ll notice patterns worth a question.</p>}

      {feed && feed.scenes.length > 0 && (
        <div style={card}>
          <div style={heading}>Next scene</div>
          {feed.scenes.map(s => (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{s.text}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={small}>{s.reason}</span>
                <button style={pill} onClick={() => startSprint(s.text)}>Start a sprint</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.map(summary => {
        const prompt = buildConfirmationPrompt(summary, nameOf(summary.entityId), knowledge);
        const key = `${summary.entityId}|${summary.kind}`;
        return (
          <div key={key} style={card}>
            <div style={heading}>{prompt.question}</div>
            {prompt.evidence.map(ev => <PassageLink key={ev.id} chapterId={ev.chapterId} quote={ev.sentence} where={ev.unitTitle} commentText={commentTextFor(prompt.question, 'Shown through: ' + ev.mode)} />)}
            {prompt.followUp && <div style={small}>{prompt.followUp}</div>}
            <textarea
              placeholder="In your own words: how do you show this? (optional)"
              value={explanations[key] ?? ''}
              onChange={e => setExplanations(prev => ({ ...prev, [key]: e.target.value }))}
              rows={2}
              style={{ resize: 'vertical', fontSize: '0.8rem', padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-main)' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {RESPONSES.map(r => <button key={r.verdict} style={pill} onClick={() => respond(prompt.evidence[0], r.verdict, key)}>{r.label}</button>)}
            </div>
            <GrowCues
              sentence={prompt.evidence[0].sentence}
              names={entityNames}
              kind={summary.kind}
              defaultMode={prompt.evidence[0].mode}
              knowledge={knowledge}
              onChange={setCoachKnowledge}
            />
          </div>
        );
      })}

      {feed?.why.map(n => (
        <NudgeCard key={n.id} n={n} extra={
          <button style={pill} onClick={() => {
            if (n.chain) save(advanceChain(memory, n.chain.entityId, n.chain.kind));
          }}>Next question</button>
        } />
      ))}

      {worthALook.map(n => {
        const finding = feed?.ruleFindings.find(f => f.id === n.id);
        return (
          <NudgeCard
            key={n.id}
            n={n}
            extra={finding && analysis ? (
              <RuleActions finding={finding} taught={memory.taught} sentences={analysis.sentences} onChange={saveTaught} onDismiss={() => save(dismissNudge(memory, n.id))} />
            ) : undefined}
            hideDismiss={!!finding}
          />
        );
      })}

      {feed && on('promiseBoard') && feed.board.length > 0 && (
        <div style={card}>
          <div style={heading}>Promises, secrets, warnings, questions</div>
          {feed.board.slice(0, 8).map(b => (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={small}><strong>{b.kind}</strong> · {b.unitTitle} · open {b.age} section{b.age === 1 ? '' : 's'} · revisited {b.revisits}×</div>
              <PassageLink chapterId={b.chapterId} quote={b.sentence} commentText={commentTextFor(`Open ${b.kind}`, `Raised in ${b.unitTitle}. Does it pay off?`)} />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button style={pill} onClick={() => dismissLoop(b.id)}>Handled</button>
                {project.plotThreads.some(t => t.loopId === b.id)
                  ? <button style={pill} onClick={() => setSidebarTab('threads')}>Tracked →</button>
                  : <button style={pill} onClick={() => trackLoopAsThread(b.id)} title="Keep an eye on this as a plot thread">Track as thread</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {gaps.length > 0 && (
        <div style={card}>
          <div style={heading}>Brought up, then gone?</div>
          {gaps.map(g => (
            <div key={g.entity.id} style={small}>
              <strong>{g.entity.canonical}</strong>{' '}
              {g.kind === 'single_mention'
                ? `is mentioned once (${g.entity.mentions[0].unitTitle}) and never again.`
                : `was last seen in ${g.entity.mentions[g.entity.mentions.length - 1].unitTitle}, ${g.unitsSince} sections ago.`}
            </div>
          ))}
          <div style={small}>These are questions, not problems. Some people are meant to be mentioned once.</div>
        </div>
      )}

      {on('storyRules') && analysis && <TeachPanel taught={memory.taught} sentences={analysis.sentences} onChange={saveTaught} />}

      {feed?.tells && (
        <div style={card}>
          <div style={heading}>Your tells</div>
          <div style={small}>
            {feed.tells.stats.sentences} sentences · {feed.tells.stats.avgSentenceWords} words each on average · {Math.round(feed.tells.stats.dialogueShare * 100)}% dialogue · {Math.round(feed.tells.stats.oneLineParagraphShare * 100)}% one-line paragraphs
          </div>
          {feed.tells.phrases.length > 0 && <div style={small}>Phrases you return to: {feed.tells.phrases.map(p => `“${p.phrase}” ×${p.count}`).join(', ')}</div>}
          {feed.tells.starters.length > 0 && <div style={small}>Sentences often start with: {feed.tells.starters.map(s => `${s.word} ×${s.count}`).join(', ')}</div>}
          <div style={small}>These are measurements, not corrections. Plenty of writers repeat on purpose.</div>
        </div>
      )}

      {on('sparks') && analysis && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={heading}>Spark with your cast</div>
            <button style={pill} onClick={() => setSpark(castSpark(analysis.index))}>{spark ? 'Another' : 'Roll one'}</button>
          </div>
          {spark && (
            <>
              {spark.cast.length > 0 && <div style={small}>Starring: {spark.cast.join(' and ')}</div>}
              {spark.trope && <div style={small}>Trope: {spark.trope}</div>}
              <div style={small}>Where: {spark.spark.setting.where}</div>
              <div style={small}>When: {spark.spark.setting.when}</div>
              <div style={small}>Why: {spark.spark.setting.why}</div>
              {spark.spark.scene && <div style={small}>Scene ({spark.spark.scene.goal}): {spark.spark.scene.text}</div>}
              <div style={small}>Words: {spark.spark.words.join(', ')}</div>
              <button style={{ ...pill, alignSelf: 'flex-start' }} onClick={() => startSprint(`${spark.cast.join(' and ')}. ${spark.spark.setting.where} ${spark.spark.scene?.text ?? ''}`.trim())}>Start a sprint</button>
            </>
          )}
        </div>
      )}

      <button onClick={() => setShowLearned(v => !v)} style={linkBtn}>
        What I’ve learned about your writing ({memory.profile.patterns.length} patterns, {memory.profile.examples.length} examples)
      </button>
      {showLearned && (
        <div style={card}>
          {memory.profile.patterns.length === 0 && memory.profile.examples.length === 0 && <div style={small}>Nothing yet.</div>}
          {memory.profile.patterns.map(p => (
            <div key={p.id} style={{ ...small, display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span><strong>{p.kind}</strong> via {p.mode}: {p.words.join(', ')} — {p.confirmations >= 2 ? 'active' : `needs ${2 - p.confirmations} more confirmation`}</span>
              <button onClick={() => save(deletePattern(memory, p.id))}>Delete</button>
            </div>
          ))}
          {memory.profile.examples.map(ex => (
            <div key={ex.id} style={{ ...small, display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span>“{ex.sentence}” — {ex.verdict}{ex.explanation ? `: ${ex.explanation}` : ''}</span>
              <button onClick={() => save(forgetExample(memory, ex.id))}>Forget</button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowKnowledge(v => !v)} style={linkBtn}>What I look for (feelings, events, promises…)</button>
      {showKnowledge && <KnowledgeEditor knowledge={knowledge} onChange={setCoachKnowledge} />}

      <button onClick={() => setShowSettings(v => !v)} style={linkBtn}>Coach settings</button>
      {showSettings && (
        <div style={card}>
          <label style={{ ...small, display: 'flex', gap: '6px' }}>
            <input type="checkbox" checked={settings.learning} onChange={() => setCoachSettings({ ...settings, learning: !settings.learning })} />
            Learn from my answers
          </label>
          {(Object.keys(COACH_FEATURES) as CoachFeatureKey[]).map(key => (
            <label key={key} style={{ ...small, display: 'flex', gap: '6px' }}>
              <input type="checkbox" checked={settings.features[key]} onChange={() => toggleFeature(key)} />
              <span><strong>{COACH_FEATURES[key].label}</strong> — {COACH_FEATURES[key].description}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
