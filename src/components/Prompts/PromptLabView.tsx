import React, { useEffect, useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import * as muse from '../../services/muse/generators';
import { filterPrompts, type PromptLength, type PromptThemes } from '../../services/muse/filters';
import { statRows as rollStatRows, rollStat } from '../../services/sheets';
import type { StatKind } from '../../types';
import { getDefaultKnowledge } from '../../services/coach/knowledge';
import { ArrowLeft, Shuffle, Zap, BookPlus, Copy, Dices } from 'lucide-react';

interface Row {
  label: string;
  value: string;
  // rows with a key can be rerolled on their own, like `!char desire` on the bot.
  key?: string;
  // the field's short name, shown beside its label.
  hint?: string;
}

// one normalized shape so every Muse tool renders the same way.
interface Result {
  heading?: string;
  lines: string[];
  tags?: string[];
  palette?: string[];
  rows?: Row[];
  // plain text used for sprints, copying, and the draft header.
  text: string;
}

type Opts = Record<string, string>;

interface OptionDef {
  key: string;
  label: string;
  type: 'select' | 'multi' | 'text';
  choices?: string[];
  note?: string;
}

interface Tool {
  id: string;
  label: string;
  group: 'Spark' | 'Prompts' | 'Characters' | 'Story' | 'Words & color';
  options?: OptionDef[];
  roll: (o: Opts) => Result | undefined;
  rerollRow?: (r: Result, key: string, o: Opts) => Result;
  // roll one color of a palette again
  rerollSwatch?: (r: Result, index: number, o: Opts) => Result;
  // tools backed by a long list can also be browsed and searched.
  browse?: (o: Opts) => string[];
  // roll again whenever an option changes.
  autoRoll?: boolean;
}

// multi-choice options are kept as one string.
const SEP = '|';
const listOf = (v: string | undefined) => (v ? v.split(SEP).filter(Boolean) : []);
const rowsText = (rows: Row[]) => rows.map(r => `${r.label}: ${r.value}`).join('\n');
const withRows = (rows: Row[], heading?: string): Result => ({ rows, heading, lines: [], text: rowsText(rows) });
// rolls one row again, keeping the others; `again` gives the new label or value for that row
const rerollWith = (r: Result, key: string, again: () => Partial<Row> | undefined): Result => {
  const out = withRows((r.rows ?? []).map(row => (row.key === key ? { ...row, ...(again() ?? {}) } : row)), r.heading);
  return { ...r, rows: out.rows, text: out.text };
};
const rowValue = (r: Result, key: string) => r.rows?.find(x => x.key === key)?.value ?? '';

const characterRows = (c: Record<muse.CharacterField, string>): Row[] =>
  muse.CHARACTER_FIELDS.map(f => ({ label: muse.CHARACTER_FIELD_LABELS[f], value: c[f], key: f, hint: f }));

const statRows = (kind: string): Row[] => rollStatRows(kind as StatKind);

const faultResult = (o: Opts, a: string, b: string, but: string): Result => {
  const nameA = o.a?.trim() || 'Character A';
  const nameB = o.b?.trim() || 'Character B';
  const rows = [{ label: `${nameA} wants`, value: a, key: 'a' }, { label: `${nameB} wants`, value: b, key: 'b' }, { label: 'But', value: but, key: 'but' }];
  return { ...withRows(rows), text: `${nameA} wants ${a}. ${nameB} wants ${b}. But ${but}` };
};

const makeTools = (promptThemes: PromptThemes): Tool[] => [
  {
    id: 'spark', label: 'Spark', group: 'Spark',
    roll: () => {
      const s = muse.generateSpark();
      const rows: Row[] = [
        ...muse.CHARACTER_FIELDS.map(f => ({ label: muse.CHARACTER_FIELD_LABELS[f], value: s.character[f], key: f })),
        ...muse.SETTING_FIELDS.map(f => ({ label: f.charAt(0).toUpperCase() + f.slice(1), value: s.setting[f], key: `set:${f}` })),
      ];
      if (s.scene) rows.push({ label: `Scene (${s.scene.goal})`, value: s.scene.text, key: 'scene' });
      if (s.trope) rows.push({ label: 'Trope', value: s.trope.text, key: 'trope' });
      if (s.narration) rows.push({ label: `Narration: ${s.narration.name}`, value: s.narration.description, key: 'narration' });
      rows.push({ label: 'Words', value: s.words.join(', '), key: 'words' });
      if (s.object) rows.push({ label: 'Object', value: s.object, key: 'object' });
      return { ...withRows(rows), palette: s.palette };
    },
    rerollRow: (r, key) => rerollWith(r, key, () => {
      if (key.startsWith('set:')) return { value: muse.rerollSettingField(key.slice(4) as muse.SettingField) };
      if (key === 'scene') { const s = muse.randomSceneStarter(); return s && { label: `Scene (${s.goal})`, value: s.text }; }
      if (key === 'trope') return { value: muse.pickTrope()?.text ?? '' };
      if (key === 'narration') { const n = muse.randomNarration(); return n && { label: `Narration: ${n.name}`, value: n.description }; }
      if (key === 'words') return { value: muse.pickMany(muse.WORDS, 3).join(', ') };
      if (key === 'object') return { value: muse.pick(muse.CHAR_OBJECTS) ?? '' };
      return { value: muse.rerollCharacterField(key as muse.CharacterField) };
    }),
    rerollSwatch: (r, i) => ({ ...r, palette: (r.palette ?? []).map((c, j) => (j === i ? muse.generatePalette({ count: 1 })[0] : c)) }),
  },
  {
    id: 'prompt', label: 'Writing prompt', group: 'Prompts',
    options: [
      { key: 'themes', label: 'Themes', type: 'multi', choices: Object.keys(promptThemes), note: 'Found by looking for words in each prompt, so they are a guide, not a label Callie gave them.' },
      { key: 'length', label: 'Length', type: 'select', choices: ['any', 'short', 'medium', 'long'] },
      { key: 'search', label: 'Contains', type: 'text' },
    ],
    roll: o => {
      const t = muse.pick(filterPrompts(muse.PROMPTS, { themes: listOf(o.themes), length: (o.length as PromptLength) || 'any', search: o.search }, promptThemes));
      return t ? { lines: [t], text: t } : undefined;
    },
    browse: o => filterPrompts(muse.PROMPTS, { themes: listOf(o.themes), length: (o.length as PromptLength) || 'any', search: o.search }, promptThemes),
  },
  {
    id: 'starter', label: 'Scene starter', group: 'Prompts',
    options: [{ key: 'goal', label: 'Goal', type: 'select', choices: ['any', ...muse.SCENE_GOALS] }],
    roll: o => { const r = muse.randomSceneStarter(o.goal === 'any' ? undefined : o.goal); return r ? { heading: r.goal, lines: [r.text], text: r.text } : undefined; },
  },
  {
    id: 'continue', label: 'Continue the scene', group: 'Prompts',
    options: [{ key: 'goal', label: 'Goal', type: 'select', choices: ['any', ...muse.CONTINUE_GOALS] }],
    roll: o => { const r = muse.randomContinueScene(o.goal === 'any' ? undefined : o.goal); return r ? { heading: r.goal, lines: [r.text], text: r.text } : undefined; },
  },
  {
    id: 'oneliner', label: 'One-liner', group: 'Prompts',
    options: [{ key: 'tag', label: 'Type', type: 'select', choices: ['any', ...muse.ONELINER_TAGS] }],
    roll: o => { const r = muse.randomOneLiner(o.tag === 'any' ? undefined : o.tag); return r ? { heading: r.tag, lines: [r.text], text: r.text } : undefined; },
  },
  {
    id: 'exercise', label: 'Exercise', group: 'Prompts',
    options: [{ key: 'type', label: 'Type', type: 'select', choices: ['any', ...muse.EXERCISE_TYPES] }],
    roll: o => {
      const r = muse.randomExercise(o.type === 'any' ? undefined : o.type);
      if (!r) return undefined;
      const lines = [r.exercise.instruction, ...(r.exercise.constraint ? [`Constraint: ${r.exercise.constraint}`] : []), ...(r.exercise.duration ? [`Time: ${r.exercise.duration}`] : [])];
      return { heading: `${r.exercise.name} (${r.type})`, lines, text: r.exercise.instruction };
    },
  },
  {
    // works like `!char`: the full set, or reroll a single field.
    id: 'character', label: 'Character generator', group: 'Characters',
    options: [{ key: 'stats', label: 'Stats', type: 'select', choices: ['none', 'classic', 'psych', 'both'] }],
    roll: o => withRows([...characterRows(muse.generateCharacter()), ...(o.stats && o.stats !== 'none' ? statRows(o.stats) : [])]),
    rerollRow: (r, key) => {
      const rows = (r.rows ?? []).map(row => {
        if (row.key !== key) return row;
        if (key.startsWith('stat:')) return { ...row, value: rollStat(key) };
        return { ...row, value: muse.rerollCharacterField(key as muse.CharacterField) };
      });
      return withRows(rows);
    },
  },
  {
    id: 'autopsy', label: 'Character autopsy', group: 'Characters',
    roll: () => {
      const p = muse.randomAutopsy();
      if (!p) return undefined;
      const rows = p.questions.map((q, i) => ({ label: `Question ${i + 1}`, value: q, key: `q${i}` }));
      return { ...withRows(rows, p.title), text: p.questions.join('\n') };
    },
    rerollRow: (r, key) => {
      const out = rerollWith(r, key, () => ({ value: muse.pick(muse.pick(muse.AUTOPSY_PACKETS)?.questions ?? []) ?? '' }));
      return { ...out, text: (out.rows ?? []).map(x => x.value).join('\n') };
    },
  },
  {
    id: 'faultline', label: 'Faultline', group: 'Characters',
    options: [{ key: 'a', label: 'Character A', type: 'text' }, { key: 'b', label: 'Character B', type: 'text' }],
    autoRoll: false,
    roll: o => {
      const f = muse.randomFaultline();
      if (!f) return undefined;
      return faultResult(o, f.a_wants, f.b_wants, f.but);
    },
    rerollRow: (r, key, o) => {
      const f = muse.randomFaultline();
      if (!f) return r;
      const now = { a: rowValue(r, 'a'), b: rowValue(r, 'b'), but: rowValue(r, 'but') };
      if (key === 'a') now.a = f.a_wants;
      else if (key === 'b') now.b = f.b_wants;
      else now.but = f.but;
      return faultResult(o, now.a, now.b, now.but);
    },
  },
  {
    id: 'stats', label: 'Stats', group: 'Characters',
    options: [{ key: 'type', label: 'Kind', type: 'select', choices: ['classic', 'psych', 'both'] }],
    roll: o => withRows(statRows(o.type ?? 'classic')),
    rerollRow: (r, key) => rerollWith(r, key, () => ({ value: rollStat(key) })),
  },
  {
    id: 'descent', label: 'Descent', group: 'Characters',
    roll: () => { const t = muse.pick(muse.DESCENT_SEEDS); return t ? { lines: [t], text: t } : undefined; },
    browse: () => muse.DESCENT_SEEDS,
  },
  {
    // works like `!setting`: choose which of who/what/where/when/why, or all of them.
    id: 'scenegen', label: 'Scene generator', group: 'Story',
    options: [
      { key: 'fields', label: 'Roll', type: 'multi', choices: [...muse.SETTING_FIELDS], note: 'Pick some, or leave them all off to roll all five.' },
      { key: 'starter', label: 'Scene starter', type: 'select', choices: ['none', 'any', ...muse.SCENE_GOALS] },
    ],
    roll: o => {
      const chosen = listOf(o.fields) as muse.SettingField[];
      const fields = muse.SETTING_FIELDS.filter(f => !chosen.length || chosen.includes(f));
      const rows: Row[] = fields.map(f => ({ label: f.charAt(0).toUpperCase() + f.slice(1), value: muse.rerollSettingField(f), key: f }));
      if (o.starter && o.starter !== 'none') {
        const s = muse.randomSceneStarter(o.starter === 'any' ? undefined : o.starter);
        if (s) rows.push({ label: `Scene starter (${s.goal})`, value: s.text, key: 'starter' });
      }
      return withRows(rows);
    },
    rerollRow: (r, key, o) => withRows((r.rows ?? []).map(row => {
      if (row.key !== key) return row;
      if (key === 'starter') {
        const s = muse.randomSceneStarter(o.starter === 'any' ? undefined : o.starter);
        return s ? { ...row, label: `Scene starter (${s.goal})`, value: s.text } : row;
      }
      return { ...row, value: muse.rerollSettingField(key as muse.SettingField) };
    })),
  },
  {
    id: 'trope', label: 'Trope', group: 'Story',
    options: [
      { key: 'include', label: 'Must have', type: 'multi', choices: muse.TROPE_TAGS },
      { key: 'exclude', label: 'Leave out', type: 'multi', choices: muse.TROPE_TAGS },
    ],
    roll: o => { const t = muse.pickTrope({ include: listOf(o.include), exclude: listOf(o.exclude) }); return t ? { lines: [t.text], tags: t.tags, text: t.text } : undefined; },
    browse: o => {
      const inc = listOf(o.include), exc = listOf(o.exclude);
      return muse.TROPES.filter(t => inc.every(i => t.tags.includes(i)) && !exc.some(e => t.tags.includes(e))).map(t => t.text);
    },
  },
  {
    id: 'narration', label: 'Narration style', group: 'Story',
    roll: () => { const n = muse.randomNarration(); return n ? { heading: n.name, lines: [n.description], tags: n.tags, text: `${n.name}: ${n.description}` } : undefined; },
  },
  {
    id: 'words', label: 'Word spread', group: 'Words & color',
    options: [{ key: 'n', label: 'How many', type: 'select', choices: ['2', '3', '4', '5', '6', '8', '10'] }],
    roll: o => {
      const w = muse.pickMany(muse.WORDS, Number(o.n) || 4);
      return { ...withRows(w.map((x, i) => ({ label: `Word ${i + 1}`, value: x, key: `w${i}` }))), text: w.join(', ') };
    },
    rerollRow: (r, key) => {
      const out = rerollWith(r, key, () => ({ value: muse.pick(muse.WORDS.filter(x => !(r.rows ?? []).some(row => row.value === x))) ?? '' }));
      return { ...out, text: (out.rows ?? []).map(x => x.value).join(', ') };
    },
  },
  {
    id: 'palette', label: 'Palette', group: 'Words & color',
    options: [
      { key: 'count', label: 'Colors', type: 'select', choices: ['1', '2', '3', '4', '5', '6'] },
      { key: 'family', label: 'Family', type: 'select', choices: ['any', 'cool', 'warm', 'neutral'] },
      { key: 'tone', label: 'Tone', type: 'select', choices: ['any', 'dark', 'light', 'pastel'] },
      { key: 'hue', label: 'Hue', type: 'select', choices: ['any', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black', 'gray'] },
      { key: 'rainbow', label: 'Rainbow', type: 'select', choices: ['no', 'yes'] },
    ],
    roll: o => {
      const palette = muse.generatePalette({
        count: Number(o.count) || 3,
        family: o.family && o.family !== 'any' ? (o.family as muse.PaletteFamily) : undefined,
        tone: o.tone && o.tone !== 'any' ? (o.tone as muse.PaletteTone) : undefined,
        hue: o.hue && o.hue !== 'any' ? (o.hue as muse.PaletteHue) : undefined,
        rainbow: o.rainbow === 'yes',
      });
      return { lines: [], palette, text: palette.join(' ') };
    },
    rerollSwatch: (r, i, o) => {
      const one = muse.generatePalette({
        count: 1,
        family: o.family && o.family !== 'any' ? (o.family as muse.PaletteFamily) : undefined,
        tone: o.tone && o.tone !== 'any' ? (o.tone as muse.PaletteTone) : undefined,
        hue: o.hue && o.hue !== 'any' ? (o.hue as muse.PaletteHue) : undefined,
      })[0];
      const palette = (r.palette ?? []).map((c, j) => (j === i ? one : c));
      return { ...r, palette, text: palette.join(' ') };
    },
  },
  {
    id: 'pickone', label: 'Color, animal, object', group: 'Words & color',
    options: [{ key: 'kind', label: 'Kind', type: 'select', choices: ['color', 'animal', 'object'] }],
    roll: o => {
      const list = o.kind === 'animal' ? muse.ANIMALS : o.kind === 'object' ? muse.CHAR_OBJECTS : muse.COLORS;
      const t = muse.pick(list);
      return t ? { lines: [t], text: t } : undefined;
    },
  },
];

const GROUPS = ['Spark', 'Prompts', 'Characters', 'Story', 'Words & color'] as const;

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', textAlign: 'left',
  color: active ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
  backgroundColor: active ? 'var(--accent-gold-bg)' : 'transparent',
  fontWeight: active ? 600 : 400,
});

const selectStyle: React.CSSProperties = { padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-paper)', color: 'var(--text-main)' };

export const PromptLabView: React.FC = () => {
  const { setViewMode, setIsSprintModalOpen, setSprintPresetPrompt, createChapter, showToast, promptLabTool, setPromptLabTool, userStats } = useAsterism();
  const themes = userStats.coachKnowledge?.promptThemes ?? getDefaultKnowledge().promptThemes;
  const TOOLS = useMemo(() => makeTools(themes), [themes]);
  // the home page can open the lab straight onto a tool (character or scene generator).
  const [toolId, setToolId] = useState(() => (TOOLS.some(t => t.id === promptLabTool) ? promptLabTool! : 'spark'));
  const tool = TOOLS.find(t => t.id === toolId)!;
  const [opts, setOpts] = useState<Opts>({});
  const [result, setResult] = useState<Result | undefined>(() => tool.roll({}));
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { if (promptLabTool) setPromptLabTool(null); }, [promptLabTool, setPromptLabTool]);

  const selectTool = (id: string) => {
    const next = TOOLS.find(t => t.id === id)!;
    setToolId(id);
    setOpts({});
    setSearch('');
    setResult(next.roll({}));
  };
  const reroll = (o: Opts = opts) => setResult(tool.roll(o));
  const setOpt = (key: string, value: string) => {
    const o = { ...opts, [key]: value };
    setOpts(o);
    if (tool.autoRoll !== false) reroll(o);
  };
  const toggleMulti = (key: string, choice: string) => {
    const now = listOf(opts[key]);
    setOpt(key, (now.includes(choice) ? now.filter(c => c !== choice) : [...now, choice]).join(SEP));
  };

  const matching = tool.browse ? tool.browse(opts) : [];
  const browseItems = (search.trim() ? matching.filter(t => t.toLowerCase().includes(search.trim().toLowerCase())) : matching).slice(0, 80);

  const startSprint = () => {
    if (!result) return;
    setSprintPresetPrompt(result.text);
    setIsSprintModalOpen(true);
    setViewMode('standard');
  };

  const saveDraft = () => {
    if (!draft.trim() || !result) {
      showToast('Write a few words first.', 'info');
      return;
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<blockquote><em>${esc(result.text).replace(/\n/g, '<br/>')}</em></blockquote><p>${esc(draft).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
    createChapter(`Prompt: ${result.text.slice(0, 32)}…`, html);
    setDraft('');
    showToast('Saved to your manuscript as a new chapter.', 'success');
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result.text).then(() => showToast('Copied.', 'info'), () => undefined);
  };

  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', overflow: 'hidden' }}>
      <header style={{ height: '56px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', display: 'flex', alignItems: 'center', gap: '14px', padding: '0 20px', flexShrink: 0 }}>
        <button onClick={() => setViewMode('standard')} style={btn}><ArrowLeft size={15} /><span>Back</span></button>
        <h1 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-title)', margin: 0 }}>Prompt Lab</h1>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav style={{ width: '210px', borderRight: '1px solid var(--border-subtle)', padding: '14px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flexShrink: 0 }}>
          {GROUPS.map(g => (
            <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0 10px 4px' }}>{g}</div>
              {TOOLS.filter(t => t.group === g).map(t => (
                <button key={t.id} onClick={() => selectTool(t.id)} style={chip(t.id === toolId)}>{t.label}</button>
              ))}
            </div>
          ))}
        </nav>

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
          {tool.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tool.options.map(o => (
                <div key={o.key} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>{o.label}</span>
                  {o.type === 'select' && (
                    <select value={opts[o.key] ?? o.choices![0]} onChange={e => setOpt(o.key, e.target.value)} style={{ ...selectStyle, alignSelf: 'flex-start' }}>
                      {o.choices!.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {o.type === 'text' && (
                    <input value={opts[o.key] ?? ''} onChange={e => setOpt(o.key, e.target.value)} placeholder={o.label} style={{ ...selectStyle, alignSelf: 'flex-start', minWidth: 220 }} />
                  )}
                  {o.type === 'multi' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {o.choices!.map(c => {
                        const on = listOf(opts[o.key]).includes(c);
                        return (
                          <button key={c} onClick={() => toggleMulti(o.key, c)}
                            style={{ padding: '3px 9px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', background: on ? 'var(--accent-gold-bg)' : 'transparent', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)' }}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {o.note && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{o.note}</span>}
                </div>
              ))}
              {tool.browse && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{matching.length} match{matching.length === 1 ? '' : 'es'}</div>}
            </div>
          )}

          <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-paper)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {result?.heading && <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>{result.heading}</div>}
            {result?.lines.map((l, i) => <p key={i} style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.55, fontFamily: 'var(--font-title)' }}>{l}</p>)}
            {result?.rows?.map(r => (
              <div key={r.label + (r.key ?? '')} style={{ display: 'flex', gap: '12px', fontSize: '0.92rem', lineHeight: 1.5, alignItems: 'flex-start' }}>
                <span style={{ width: '170px', flexShrink: 0, color: 'var(--text-secondary)' }}>
                  {r.label}{r.hint && <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}> ({r.hint})</span>}
                </span>
                <span style={{ flex: 1 }}>{r.value}</span>
                {r.key && tool.rerollRow && (
                  <button onClick={() => result && setResult(tool.rerollRow!(result, r.key!, opts))} title="Roll just this one" style={{ color: 'var(--text-secondary)', display: 'flex', padding: 2 }}><Dices size={15} /></button>
                )}
              </div>
            ))}
            {result?.palette && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.palette.map((c, i) => (
                  <div key={`${c}-${i}`} style={{ width: '92px' }}>
                    <div style={{ height: '56px', background: c, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }} />
                    <div style={{ fontSize: '0.74rem', textAlign: 'center', marginTop: '3px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                      {c}
                      {tool.rerollSwatch && (
                        <button onClick={() => setResult(tool.rerollSwatch!(result, i, opts))} title="Roll just this color" aria-label={`Roll ${c} again`} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 2 }}><Dices size={13} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {result?.tags && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{result.tags.join(' · ')}</div>}
            {!result && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Nothing matches those options.</p>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button onClick={() => reroll()} style={btn}><Shuffle size={14} /><span>{tool.rerollRow || tool.rerollSwatch ? 'Roll everything' : 'Random one'}</span></button>
              <button onClick={startSprint} style={btn} disabled={!result}><Zap size={14} /><span>Start a sprint</span></button>
              <button onClick={copy} style={btn} disabled={!result}><Copy size={14} /><span>Copy</span></button>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6} placeholder="Write here, then save it as a chapter."
              style={{ width: '100%', resize: 'vertical', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-paper)', color: 'var(--text-main)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }} />
            <div><button onClick={saveDraft} style={btn}><BookPlus size={14} /><span>Save as chapter</span></button></div>
          </section>

          {tool.browse && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search these ${matching.length}…`}
                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-paper)', color: 'var(--text-main)' }} />
              {browseItems.map((t, i) => (
                <button key={i} onClick={() => setResult({ lines: [t], text: t })}
                  style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>{t}</button>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
