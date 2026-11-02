import React, { useMemo, useState } from 'react';
import {
  addRule, addTerms, createConcept, deleteConcept, deleteRule, labelExample, matchesOf, removeTerm, setRuleEnabled,
  splitList, stems, suggestTerms, MAX_CONCEPTS, MAX_RULES, type Concept, type RuleFinding, type RuleKind, type SentenceRef, type StoryRule, type Taught,
} from '../../services/coach/teach';
import { PassageLink } from '../Common/PassageLink';
import { Plus, Trash2, X } from 'lucide-react';

const small: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 };
const heading: React.CSSProperties = { fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' };
const card: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' };
const pill: React.CSSProperties = { padding: '4px 8px', fontSize: '0.74rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)' };
const field: React.CSSProperties = { padding: '6px 8px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-main)', width: '100%', boxSizing: 'border-box' };

const KINDS: Array<{ id: RuleKind; label: string; describe: (a: string, b: string, n: number) => string }> = [
  { id: 'always_with', label: 'Whenever A appears, B should show up after it', describe: (a, b, n) => `Whenever there’s ${a}, ${b} should show up within ${n} sentence${n === 1 ? '' : 's'}.` },
  { id: 'only_with', label: 'A should only appear alongside B', describe: (a, b, n) => `${a} should only appear with ${b} within ${n} sentence${n === 1 ? '' : 's'} of it.` },
  { id: 'never_with', label: 'A and B should never appear together', describe: (a, b, n) => `${a} and ${b} shouldn’t appear within ${n} sentence${n === 1 ? '' : 's'} of each other.` },
];

interface SideDraft { name: string; words: string; examples: string }
const blank: SideDraft = { name: '', words: '', examples: '' };

const SideForm: React.FC<{ title: string; value: SideDraft; onChange: (v: SideDraft) => void; placeholder: string }> = ({ title, value, onChange, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ ...small, fontWeight: 600 }}>{title}</div>
    <input style={field} placeholder={placeholder} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} />
    <input style={field} placeholder="Key words, separated by commas (optional)" value={value.words} onChange={e => onChange({ ...value, words: e.target.value })} />
    <textarea style={{ ...field, resize: 'vertical' }} rows={2} placeholder="Example sentences from your writing, one per line (optional)" value={value.examples} onChange={e => onChange({ ...value, examples: e.target.value })} />
  </div>
);

// a concept, and a place to teach it: remove or add key words, and say yes/no to what it found.
const ConceptReview: React.FC<{ concept: Concept; sentences: SentenceRef[]; taught: Taught; onChange: (t: Taught) => void }> = ({ concept, sentences, taught, onChange }) => {
  const matches = useMemo(() => matchesOf(concept, sentences), [concept, sentences]);
  const suggestions = useMemo(() => suggestTerms(concept, sentences), [concept, sentences]);
  const [newTerm, setNewTerm] = useState('');
  const sure = matches.filter(m => m.score.status === 'match');
  const unsure = matches.filter(m => m.score.status === 'maybe');
  // ask about the unsure ones first: those are where an answer teaches the most.
  const toReview = [...unsure.slice(0, 4), ...sure.slice(0, 3)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
      <div style={{ ...small, fontWeight: 600 }}>{concept.name}: {sure.length} sure, {unsure.length} unsure</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {concept.terms.map(t => (
          <span key={t} style={{ ...pill, display: 'flex', alignItems: 'center', gap: 4 }}>{t}
            <button onClick={() => onChange(removeTerm(taught, concept.id, t))} title="Remove" style={{ display: 'flex', color: 'var(--text-muted)' }}><X size={11} /></button>
          </span>
        ))}
        {suggestions.map(t => (
          <button key={t} onClick={() => onChange(addTerms(taught, concept.id, [t]))} title="Suggested from your examples. Click to add as a key word." style={{ ...pill, borderStyle: 'dashed', color: 'var(--accent-gold-text, var(--accent-gold))' }}>+ {t}</button>
        ))}
        <input value={newTerm} onChange={e => setNewTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTerm.trim()) { onChange(addTerms(taught, concept.id, splitList(newTerm))); setNewTerm(''); } }}
          placeholder="add a word" style={{ ...field, width: 110, padding: '3px 6px' }} />
      </div>
      {toReview.map(m => (
        <div key={m.index} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PassageLink chapterId={m.chapterId} quote={m.sentence} where={m.unitTitle} commentText={`${concept.name}`} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ ...small, fontSize: '0.72rem' }}>
              {m.score.via === 'term' ? 'matches a key word' : `${Math.round(m.score.probability * 100)}% sure${m.score.because.length ? `, because of “${m.score.because.join('”, “')}”` : ''}`}
            </span>
            <button style={pill} onClick={() => onChange(labelExample(taught, concept.id, m.sentence, true))}>Yes, that’s {concept.name}</button>
            <button style={pill} onClick={() => onChange(labelExample(taught, concept.id, m.sentence, false))}>No</button>
          </div>
        </div>
      ))}
      {!toReview.length && <div style={small}>Nothing found yet. Add key words or example sentences and I’ll start looking.</div>}
    </div>
  );
};

// what the writer can do about one rule finding. each choice teaches the coach something.
export const RuleActions: React.FC<{ finding: RuleFinding; taught: Taught; sentences: SentenceRef[]; onChange: (t: Taught) => void; onDismiss: () => void }> = ({ finding, taught, sentences, onChange, onDismiss }) => {
  const rule = taught.rules.find(r => r.id === finding.ruleId);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  if (!rule) return null;
  const a = taught.concepts.find(c => c.id === rule.triggerId);
  const b = taught.concepts.find(c => c.id === rule.otherId);
  if (!a || !b) return null;

  // words near the flagged sentence the writer might want to count as the other concept.
  const nearby = wordsNear(finding, sentences, rule, a);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {finding.kind !== 'never_with' && <button style={pill} onClick={() => setPicking(v => !v)}>It’s fine — something here counts as {b.name}</button>}
        {finding.kind === 'never_with' && finding.partner && (
          <button style={pill} onClick={() => finding.partner && onChange(labelExample(taught, b.id, finding.partner.sentence, false))}>That isn’t {b.name}</button>
        )}
        <button style={pill} onClick={() => onChange(labelExample(taught, a.id, finding.sentence.sentence, false))}>That isn’t {a.name}</button>
        <button style={pill} onClick={onDismiss}>Exception</button>
      </div>
      {picking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={small}>Tap the words that show {b.name}. I’ll count them from now on.</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {nearby.map(w => {
              const on = chosen.includes(w);
              return (
                <button key={w} onClick={() => setChosen(c => (on ? c.filter(x => x !== w) : [...c, w]))}
                  style={{ ...pill, background: on ? 'var(--accent-gold-bg)' : 'transparent', borderColor: on ? 'var(--accent-gold)' : 'var(--border-subtle)' }}>{w}</button>
              );
            })}
          </div>
          <button style={{ ...pill, alignSelf: 'flex-start' }} disabled={!chosen.length}
            onClick={() => { onChange(addTerms(taught, b.id, chosen)); setPicking(false); setChosen([]); }}>
            Count these as {b.name}
          </button>
        </div>
      )}
    </div>
  );
};

function wordsNear(finding: RuleFinding, sentences: SentenceRef[], rule: StoryRule, trigger: Concept): string[] {
  const own = new Set([...trigger.terms.map(t => t.toLowerCase()), ...stems(trigger.name)]);
  const from = finding.sentence.index - rule.window;
  const to = finding.sentence.index + rule.window;
  const words: string[] = [];
  sentences.forEach(s => {
    if (s.chapterId === finding.sentence.chapterId && s.index >= from && s.index <= to) {
      s.stems.forEach(w => { if (!own.has(w) && !words.includes(w) && w.length > 2) words.push(w); });
    }
  });
  return words.slice(0, 30);
}

export const TeachPanel: React.FC<{ taught: Taught; sentences: SentenceRef[]; onChange: (t: Taught) => void }> = ({ taught, sentences, onChange }) => {
  const [creating, setCreating] = useState(false);
  const [ruleText, setRuleText] = useState('');
  const [kind, setKind] = useState<RuleKind>('always_with');
  const [windowSize, setWindowSize] = useState(3);
  const [a, setA] = useState<SideDraft>(blank);
  const [b, setB] = useState<SideDraft>(blank);
  const [open, setOpen] = useState<string | null>(null);

  const spec = KINDS.find(k => k.id === kind)!;
  const preview = spec.describe(a.name.trim() || 'A', b.name.trim() || 'B', windowSize);
  const ready = a.name.trim() && b.name.trim() && (a.words.trim() || a.examples.trim()) && (b.words.trim() || b.examples.trim());
  const full = taught.rules.length >= MAX_RULES || taught.concepts.length + 2 > MAX_CONCEPTS;

  const create = () => {
    const ca = createConcept(a.name, splitList(a.words), splitList(a.examples));
    const cb = createConcept(b.name, splitList(b.words), splitList(b.examples));
    const withConcepts: Taught = { ...taught, concepts: [...taught.concepts, ca, cb] };
    onChange(addRule(withConcepts, { text: ruleText.trim() || preview, kind, triggerId: ca.id, otherId: cb.id, window: windowSize }));
    setCreating(false); setRuleText(''); setA(blank); setB(blank);
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={heading}>Your story’s rules</div>
        {!creating && <button style={{ ...pill, display: 'flex', alignItems: 'center', gap: 4 }} disabled={full} onClick={() => setCreating(true)}><Plus size={12} /> Teach a rule</button>}
      </div>
      <div style={small}>Tell me a rule in your own words and show me examples. I’ll check for it and learn from your answers.</div>

      {creating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: 10 }}>
          <input style={field} placeholder="The rule, in your words (e.g. Magic always costs something)" value={ruleText} onChange={e => setRuleText(e.target.value)} />
          <select style={field} value={kind} onChange={e => setKind(e.target.value as RuleKind)}>
            {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <SideForm title="A" value={a} onChange={setA} placeholder="What is A? (e.g. Magic)" />
          <SideForm title="B" value={b} onChange={setB} placeholder="What is B? (e.g. A cost)" />
          <label style={{ ...small, display: 'flex', alignItems: 'center', gap: 8 }}>
            “Nearby” means within
            <input type="number" min={0} max={12} value={windowSize} onChange={e => setWindowSize(Number(e.target.value))} style={{ ...field, width: 56 }} />
            sentences
          </label>
          <div style={{ ...small, fontStyle: 'italic' }}>{preview}</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button style={pill} onClick={() => setCreating(false)}>Cancel</button>
            <button style={{ ...pill, background: 'var(--accent-primary)', color: '#fff', borderColor: 'transparent', opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={create}>Teach it</button>
          </div>
          {!ready && <div style={small}>Give each side a name, plus key words or an example sentence, so I know what to look for.</div>}
        </div>
      )}

      {taught.rules.length === 0 && !creating && <div style={small}>No rules yet.</div>}

      {taught.rules.map(rule => {
        const ca = taught.concepts.find(c => c.id === rule.triggerId);
        const cb = taught.concepts.find(c => c.id === rule.otherId);
        if (!ca || !cb) return null;
        const isOpen = open === rule.id;
        return (
          <div key={rule.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, opacity: rule.enabled ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={rule.enabled} onChange={e => onChange(setRuleEnabled(taught, rule.id, e.target.checked))} title="Check this rule" />
              <button onClick={() => setOpen(isOpen ? null : rule.id)} style={{ flex: 1, textAlign: 'left', color: 'var(--text-main)', fontSize: '0.84rem', fontWeight: 600 }}>{rule.text}</button>
              <button onClick={() => onChange(deleteRule(taught, rule.id))} title="Delete the rule" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Trash2 size={13} /></button>
            </div>
            <div style={small}>{KINDS.find(k => k.id === rule.kind)!.describe(ca.name, cb.name, rule.window)}</div>
            {isOpen && (
              <>
                <ConceptReview concept={ca} sentences={sentences} taught={taught} onChange={onChange} />
                <ConceptReview concept={cb} sentences={sentences} taught={taught} onChange={onChange} />
                <button style={{ ...pill, alignSelf: 'flex-start', color: 'var(--text-secondary)' }} onClick={() => { onChange(deleteConcept(deleteConcept(taught, ca.id), cb.id)); setOpen(null); }}>
                  Forget this rule and what I learned for it
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
