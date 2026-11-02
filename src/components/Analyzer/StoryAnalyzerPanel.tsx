import React, { useState, useCallback } from 'react';
import { PassageLink } from '../Common/PassageLink';
import { commentTextFor } from '../../services/passageSearch';
import { useAsterism } from '../../context/AsterismContext';
import type { AnalysisFinding, FindingCategory, ReadFactRecord, ReadKnowledgeRecord, ReadPlaceRecord, StoryLexiconConfig } from '../../types';
import { DEFAULT_STORY_LEXICON } from '../../data/defaultStoryLexicon';
import { VERDICTS, type FindingFeedback } from '../../services/analyzerFeedback';
import { FindingAnswer } from './FindingAnswer';
import { Loader } from '../Common/Loader';
import { MUSE_FOUNDATION_CARDS } from '../../data/museFoundations';
import { PreferencesSection, SuggestionBanner } from './AnalyzerPreferences';
import { 
  Sparkles, 
  Brain, 
  AlertTriangle, 
  HelpCircle, 
  Compass, 
  CheckCircle2, 
  BookMarked, 
  RefreshCw, 
  ShieldCheck, 
  MessageSquare, 
  Quote, 
  Trash2,
  Sliders,
  Award,
  Plus,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Pencil,
  Tag
} from 'lucide-react';

type SubTab = 'findings' | 'memory' | 'profile' | 'lexicon';

const SetAside: React.FC<{ ignored: boolean; onClick: () => void }> = ({ ignored, onClick }) => (
  <button onClick={onClick} style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }} title={ignored ? 'Use this again' : 'This is wrong, or about someone else'}>
    {ignored ? 'Bring back' : 'Set aside'}
  </button>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{children}</div>
);

// where each character was last seen, and the trail that led there.
const ReadPlaces: React.FC<{ places: ReadPlaceRecord[]; onIgnore: (id: string, ignored: boolean) => void }> = ({ places, onIgnore }) => {
  if (places.length === 0) {
    return <Empty>No places yet. Add some on the Story Bible’s Places tab, then scan.</Empty>;
  }
  const byCharacter = new Map<string, ReadPlaceRecord[]>();
  places.forEach(r => byCharacter.set(r.character, [...(byCharacter.get(r.character) ?? []), r]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from(byCharacter.entries()).map(([name, list]) => {
        const last = [...list].reverse().find(r => !r.ignored);
        const where = !last ? 'nothing in use' : last.how === 'set out for' ? `heading to ${last.place}` : last.how === 'arrived at' ? `arrived at ${last.place}` : last.place;
        return (
          <details key={name} style={{ borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.86rem' }}>
              {name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.74rem' }}>last seen {where}{last ? ` (${last.chapterTitle})` : ''}</span>
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {list.map(r => (
                <div key={r.id} style={{ opacity: r.ignored ? 0.55 : 1, borderLeft: '2px solid var(--border-subtle)', paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.8rem', textDecoration: r.ignored ? 'line-through' : 'none' }}>
                      <strong>{r.chapterTitle}:</strong> {r.how} {r.place}
                    </span>
                    <SetAside ignored={r.ignored} onClick={() => onIgnore(r.id, !r.ignored)} />
                  </div>
                  {r.quote && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>“{r.quote}”</div>}
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
};

const KNOWS_HOW: Record<ReadKnowledgeRecord['how'], string> = {
  owner: 'the secret is theirs',
  'marked knows': 'knows it from the start (Story Bible)',
  'marked must not know': 'must not know it (Story Bible)',
  learned: 'was told or found out',
  there: 'was there when it came up',
  spoke: 'spoke as if they knew',
};

// who knows each secret, and what shows how they came to.
const ReadKnowledge: React.FC<{ knowledge: ReadKnowledgeRecord[]; onIgnore: (id: string, ignored: boolean) => void }> = ({ knowledge, onIgnore }) => {
  if (knowledge.length === 0) {
    return <Empty>No secrets yet. Add one to a character or on the Story Bible’s Secrets tab, then scan.</Empty>;
  }
  const bySecret = new Map<string, ReadKnowledgeRecord[]>();
  knowledge.forEach(r => bySecret.set(r.secret, [...(bySecret.get(r.secret) ?? []), r]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from(bySecret.entries()).map(([secret, list]) => {
        const byCharacter = new Map<string, ReadKnowledgeRecord[]>();
        list.forEach(r => byCharacter.set(r.character, [...(byCharacter.get(r.character) ?? []), r]));
        const knowing = Array.from(byCharacter.entries()).filter(([, rows]) => rows.some(r => !r.ignored && r.how !== 'marked must not know')).map(([n]) => n);
        return (
          <details key={secret} style={{ borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.86rem' }}>
              {secret} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.74rem' }}>{knowing.length > 0 ? `known to ${knowing.join(', ')}` : 'no one else shown knowing'}</span>
            </summary>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '6px 0' }}>“{list[0].secretText}”</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {list.map(r => {
                const fixed = r.how === 'owner' || r.how === 'marked knows' || r.how === 'marked must not know';
                return (
                  <div key={r.id} style={{ opacity: r.ignored ? 0.55 : 1, borderLeft: '2px solid var(--border-subtle)', paddingLeft: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.8rem', textDecoration: r.ignored ? 'line-through' : 'none' }}>
                        <strong>{r.character}</strong> {KNOWS_HOW[r.how]}{r.chapterTitle ? ` (${r.chapterTitle})` : ''}
                      </span>
                      {!fixed && <SetAside ignored={r.ignored} onClick={() => onIgnore(r.id, !r.ignored)} />}
                    </div>
                    {r.quote && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>“{r.quote}”</div>}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
};

// what the scan read about each character: one group per person, one row per statement.
const ReadFacts: React.FC<{
  facts: ReadFactRecord[];
  onIgnore: (id: string, ignored: boolean) => void;
  onScan: () => void;
}> = ({ facts, onIgnore, onScan }) => {
  if (facts.length === 0) {
    return (
      <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span>Nothing read yet. Scan to see each character’s eye and hair color, age, marks and death.</span>
        <button onClick={onScan} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600, flexShrink: 0 }}>Scan</button>
      </div>
    );
  }
  const byCharacter = new Map<string, ReadFactRecord[]>();
  facts.forEach(f => byCharacter.set(f.character, [...(byCharacter.get(f.character) ?? []), f]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>From your last scan. Edits since then show after the next one.</span>
        <button onClick={onScan} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>Scan again</button>
      </div>
      {Array.from(byCharacter.entries()).map(([name, list]) => {
        // a kind with more than one value among the statements still in use is worth a look.
        const values = new Map<string, Set<string>>();
        list.filter(f => !f.ignored).forEach(f => {
          const k = f.kind === 'mark' ? f.label : f.kind;
          values.set(k, (values.get(k) ?? new Set()).add(f.value));
        });
        const disagree = (f: ReadFactRecord) => (values.get(f.kind === 'mark' ? f.label : f.kind)?.size ?? 0) > 1 && f.kind !== 'death';
        return (
          <details key={name} style={{ borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.86rem' }}>
              {name} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.74rem' }}>({list.length} statement{list.length === 1 ? '' : 's'})</span>
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {list.map(f => (
                <div key={f.id} style={{ opacity: f.ignored ? 0.55 : 1, borderLeft: `2px solid ${disagree(f) && !f.ignored ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.8rem', textDecoration: f.ignored ? 'line-through' : 'none' }}>
                      <strong>{f.label}:</strong> {f.value}
                      {disagree(f) && !f.ignored && <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))', marginLeft: '6px', fontSize: '0.7rem' }}>differs elsewhere</span>}
                    </span>
                    <SetAside ignored={f.ignored} onClick={() => onIgnore(f.id, !f.ignored)} />
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{f.chapterTitle}: “{f.quote}”</div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
};

interface LexiconCategory {
  key: keyof Omit<StoryLexiconConfig, 'customCategories'>;
  label: string;
  description: string;
  icon: string;
}

const LEXICON_CATEGORIES: LexiconCategory[] = [
  { key: 'deflectionPhrases', label: 'Deflection Phrases', description: 'Emotional avoidance lines characters say out loud ("I\'m fine", "Never mind")', icon: '🛡️' },
  { key: 'traumaCues', label: 'Trauma Cues', description: 'Physiological tells and hypervigilance behaviors found in prose narration', icon: '💔' },
  { key: 'tactileObjects', label: 'Chekhov\'s Objects', description: 'Items that carry narrative weight and may become dropped threads if not paid off', icon: '🔑' },
  { key: 'commitmentPhrases', label: 'Commitment Phrases', description: 'Promises, appointments, and vows between characters that need to resolve', icon: '🤝' },
  { key: 'mysteryInquiries', label: 'Mystery Inquiries', description: 'Questions and suspicions raised in dialogue or narration that demand answers', icon: '🔍' },
  { key: 'eyeColors', label: 'Eye Colors', description: 'Physical continuity tracking — catches conflicting eye color descriptions', icon: '👁️' },
  { key: 'hairColors', label: 'Hair Colors', description: 'Physical continuity tracking — catches conflicting hair color descriptions', icon: '💇' },
];

// how the writer answered a finding, in their words
const answerLabel = (feedback: FindingFeedback[] | undefined, finding: AnalysisFinding) => {
  const entry = (feedback ?? []).find(x => x.findingId === finding.id);
  return (entry && VERDICTS.find(v => v.id === entry.verdict)?.label) || finding.status;
};

export const StoryAnalyzerPanel: React.FC = () => {
  const { 
    project, 
    runStoryAnalysis, 
    isScanning,
    respondToFinding, 
    trackLoopAsThread,
    setSidebarTab, 
    openFoundationCard,
    deleteEstablishedFact,
    setStatementIgnored,
    deleteAuthorStyleRule,
    updateProject
  } = useAsterism();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('findings');
  const [filterCategory, setFilterCategory] = useState<FindingCategory | 'all'>('all');

  // lexicon tab state
  const [expandedLexCat, setExpandedLexCat] = useState<string | null>('deflectionPhrases');
  const [newPhraseInputs, setNewPhraseInputs] = useState<Record<string, string>>({});
  const [newCustomCatName, setNewCustomCatName] = useState('');
  const [newCustomCatPhrase, setNewCustomCatPhrase] = useState('');

  const findings = (project.findings || []).filter(f => !f.hiddenBy);
  const hiddenCount = (project.findings || []).length - findings.length;
  const filteredFindings = findings.filter(f => 
    filterCategory === 'all' || f.category === filterCategory
  );
  const unreviewedCount = findings.filter(f => f.status === 'unreviewed').length;

  // get the effective lexicon (custom overrides or defaults)
  const lexicon = project.memoryVault?.lexiconConfig;

  const getActiveList = (key: keyof Omit<StoryLexiconConfig, 'customCategories'>): string[] => {
    const custom = lexicon?.[key];
    if (custom && custom.length > 0) return [...custom];
    return [...DEFAULT_STORY_LEXICON[key]];
  };

  const isUsingDefaults = (key: keyof Omit<StoryLexiconConfig, 'customCategories'>): boolean => {
    const custom = lexicon?.[key];
    return !custom || custom.length === 0;
  };

  const saveLexiconList = useCallback((key: keyof Omit<StoryLexiconConfig, 'customCategories'>, newList: string[]) => {
    const existingConfig: Partial<StoryLexiconConfig> = project.memoryVault?.lexiconConfig || {};
    updateProject({
      memoryVault: {
        ...project.memoryVault,
        establishedFacts: project.memoryVault?.establishedFacts || [],
        authorStyleRules: project.memoryVault?.authorStyleRules || [],
        analysisPreferences: project.memoryVault?.analysisPreferences || { sensitivity: 'balanced', ignoreResolvedThreads: false },
        lexiconConfig: {
          deflectionPhrases: DEFAULT_STORY_LEXICON.deflectionPhrases,
          traumaCues: DEFAULT_STORY_LEXICON.traumaCues,
          tactileObjects: DEFAULT_STORY_LEXICON.tactileObjects,
          commitmentPhrases: DEFAULT_STORY_LEXICON.commitmentPhrases,
          mysteryInquiries: DEFAULT_STORY_LEXICON.mysteryInquiries,
          eyeColors: DEFAULT_STORY_LEXICON.eyeColors,
          hairColors: DEFAULT_STORY_LEXICON.hairColors,
          customCategories: existingConfig.customCategories || {},
          ...existingConfig,
          [key]: newList
        }
      }
    });
  }, [project.memoryVault, updateProject]);

  const addPhrase = (key: keyof Omit<StoryLexiconConfig, 'customCategories'>) => {
    const val = (newPhraseInputs[key] || '').trim();
    if (!val) return;
    const current = getActiveList(key);
    if (!current.includes(val)) {
      saveLexiconList(key, [...current, val]);
    }
    setNewPhraseInputs(prev => ({ ...prev, [key]: '' }));
  };

  const removePhrase = (key: keyof Omit<StoryLexiconConfig, 'customCategories'>, phrase: string) => {
    const current = getActiveList(key);
    saveLexiconList(key, current.filter(p => p !== phrase));
  };

  const resetToDefaults = (key: keyof Omit<StoryLexiconConfig, 'customCategories'>) => {
    saveLexiconList(key, [...DEFAULT_STORY_LEXICON[key]]);
  };

  // custom category management
  const customCategories = lexicon?.customCategories || {};

  const addCustomCategory = () => {
    const name = newCustomCatName.trim();
    if (!name) return;
    const existingConfig = project.memoryVault?.lexiconConfig || {};
    updateProject({
      memoryVault: {
        ...project.memoryVault,
        establishedFacts: project.memoryVault?.establishedFacts || [],
        authorStyleRules: project.memoryVault?.authorStyleRules || [],
        analysisPreferences: project.memoryVault?.analysisPreferences || { sensitivity: 'balanced', ignoreResolvedThreads: false },
        lexiconConfig: {
          deflectionPhrases: DEFAULT_STORY_LEXICON.deflectionPhrases,
          traumaCues: DEFAULT_STORY_LEXICON.traumaCues,
          tactileObjects: DEFAULT_STORY_LEXICON.tactileObjects,
          commitmentPhrases: DEFAULT_STORY_LEXICON.commitmentPhrases,
          mysteryInquiries: DEFAULT_STORY_LEXICON.mysteryInquiries,
          eyeColors: DEFAULT_STORY_LEXICON.eyeColors,
          hairColors: DEFAULT_STORY_LEXICON.hairColors,
          ...existingConfig,
          customCategories: {
            ...customCategories,
            [name]: []
          }
        }
      }
    });
    setNewCustomCatName('');
    setExpandedLexCat(`custom-${name}`);
  };

  const addCustomPhrase = (catName: string) => {
    const val = newCustomCatPhrase.trim();
    if (!val) return;
    const existingConfig = project.memoryVault?.lexiconConfig || {};
    const cats = { ...customCategories };
    cats[catName] = [...(cats[catName] || []), val];
    updateProject({
      memoryVault: {
        ...project.memoryVault,
        establishedFacts: project.memoryVault?.establishedFacts || [],
        authorStyleRules: project.memoryVault?.authorStyleRules || [],
        analysisPreferences: project.memoryVault?.analysisPreferences || { sensitivity: 'balanced', ignoreResolvedThreads: false },
        lexiconConfig: {
          deflectionPhrases: DEFAULT_STORY_LEXICON.deflectionPhrases,
          traumaCues: DEFAULT_STORY_LEXICON.traumaCues,
          tactileObjects: DEFAULT_STORY_LEXICON.tactileObjects,
          commitmentPhrases: DEFAULT_STORY_LEXICON.commitmentPhrases,
          mysteryInquiries: DEFAULT_STORY_LEXICON.mysteryInquiries,
          eyeColors: DEFAULT_STORY_LEXICON.eyeColors,
          hairColors: DEFAULT_STORY_LEXICON.hairColors,
          ...existingConfig,
          customCategories: cats
        }
      }
    });
    setNewCustomCatPhrase('');
  };

  const removeCustomPhrase = (catName: string, phrase: string) => {
    const existingConfig = project.memoryVault?.lexiconConfig || {};
    const cats = { ...customCategories };
    cats[catName] = (cats[catName] || []).filter((p: string) => p !== phrase);
    updateProject({
      memoryVault: {
        ...project.memoryVault,
        establishedFacts: project.memoryVault?.establishedFacts || [],
        authorStyleRules: project.memoryVault?.authorStyleRules || [],
        analysisPreferences: project.memoryVault?.analysisPreferences || { sensitivity: 'balanced', ignoreResolvedThreads: false },
        lexiconConfig: {
          deflectionPhrases: DEFAULT_STORY_LEXICON.deflectionPhrases,
          traumaCues: DEFAULT_STORY_LEXICON.traumaCues,
          tactileObjects: DEFAULT_STORY_LEXICON.tactileObjects,
          commitmentPhrases: DEFAULT_STORY_LEXICON.commitmentPhrases,
          mysteryInquiries: DEFAULT_STORY_LEXICON.mysteryInquiries,
          eyeColors: DEFAULT_STORY_LEXICON.eyeColors,
          hairColors: DEFAULT_STORY_LEXICON.hairColors,
          ...existingConfig,
          customCategories: cats
        }
      }
    });
  };

  const deleteCustomCategory = (catName: string) => {
    const existingConfig = project.memoryVault?.lexiconConfig || {};
    const cats = { ...customCategories };
    delete cats[catName];
    updateProject({
      memoryVault: {
        ...project.memoryVault,
        establishedFacts: project.memoryVault?.establishedFacts || [],
        authorStyleRules: project.memoryVault?.authorStyleRules || [],
        analysisPreferences: project.memoryVault?.analysisPreferences || { sensitivity: 'balanced', ignoreResolvedThreads: false },
        lexiconConfig: {
          deflectionPhrases: DEFAULT_STORY_LEXICON.deflectionPhrases,
          traumaCues: DEFAULT_STORY_LEXICON.traumaCues,
          tactileObjects: DEFAULT_STORY_LEXICON.tactileObjects,
          commitmentPhrases: DEFAULT_STORY_LEXICON.commitmentPhrases,
          mysteryInquiries: DEFAULT_STORY_LEXICON.mysteryInquiries,
          eyeColors: DEFAULT_STORY_LEXICON.eyeColors,
          hairColors: DEFAULT_STORY_LEXICON.hairColors,
          ...existingConfig,
          customCategories: cats
        }
      }
    });
  };


  const subTabStyle = (tab: SubTab) => ({
    flex: 1,
    padding: '4px 4px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem',
    fontWeight: 600,
    backgroundColor: activeSubTab === tab ? 'var(--accent-gold-bg)' : 'transparent',
    color: activeSubTab === tab ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    textAlign: 'center' as const
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* top header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Story Analyzer
          </span>
        </div>
        <button
          onClick={runStoryAnalysis}
          disabled={isScanning}
          title="Scan chapters against Story Bible and plot threads offline"
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
          {isScanning ? <Loader inline /> : <RefreshCw size={13} />}
          <span>{isScanning ? 'Scanning…' : 'Scan Now'}</span>
        </button>
      </div>

      {/* subtab navigation */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <button onClick={() => setActiveSubTab('findings')} style={subTabStyle('findings')}>
          Findings ({unreviewedCount})
        </button>
        <button onClick={() => setActiveSubTab('memory')} style={subTabStyle('memory')}>
          Memory ({project.memoryVault?.establishedFacts?.length || 0})
        </button>
        <button onClick={() => setActiveSubTab('profile')} style={subTabStyle('profile')}>
          Style ({project.memoryVault?.authorStyleRules?.length || 0})
        </button>
        <button onClick={() => setActiveSubTab('lexicon')} style={{ ...subTabStyle('lexicon'), position: 'relative' }}>
          Lexicon
          {Object.keys(customCategories).length > 0 && (
            <span style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
              display: 'inline-block'
            }} />
          )}
        </button>
      </div>

      {/* tab 1: findings */}
      {activeSubTab === 'findings' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* category filter pills */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
            {(['all', 'drafting_note', 'contradiction', 'dropped_thread', 'continuity', 'expansion'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                  backgroundColor: filterCategory === cat ? 'var(--accent-primary)' : 'var(--badge-bg)',
                  color: filterCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {cat === 'drafting_note' ? 'Drafting Notes' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* how closely to look. applies the next time you scan. */}
          {(() => {
            const prefs = project.memoryVault?.analysisPreferences || { sensitivity: 'balanced' as const, ignoreResolvedThreads: false };
            const setPrefs = (next: Partial<typeof prefs>) =>
              updateProject({ memoryVault: { ...project.memoryVault, analysisPreferences: { ...prefs, ...next } } });
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Gentle shows only firm findings. Rigorous looks harder and shows more.">
                  <span>Look</span>
                  <select
                    value={prefs.sensitivity}
                    onChange={e => setPrefs({ sensitivity: e.target.value as typeof prefs.sensitivity })}
                    style={{ fontSize: '0.74rem', padding: '2px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                  >
                    <option value="gentle">Gently</option>
                    <option value="balanced">Balanced</option>
                    <option value="rigorous">Rigorously</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Threads you marked intentionally open are always left alone.">
                  <input
                    type="checkbox"
                    checked={prefs.ignoreResolvedThreads}
                    onChange={e => setPrefs({ ignoreResolvedThreads: e.target.checked })}
                  />
                  <span>Skip threads I marked resolved</span>
                </label>
              </div>
            );
          })()}

          <SuggestionBanner />
          {hiddenCount > 0 && (
            <button onClick={() => setActiveSubTab('memory')} style={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
              {hiddenCount} hidden by your preferences
            </button>
          )}

          {isScanning && <Loader message="Reading your story…" />}
          {filteredFindings.length === 0 && !isScanning ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginTop: '10px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-gold-bg)',
                color: 'var(--accent-gold-text, var(--accent-gold))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Brain size={26} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                {findings.length === 0 ? 'No Findings Detected Yet' : 'No Findings in This Filter'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '280px' }}>
                {findings.length === 0
                  ? 'Click "Scan Now" to check your story for gaps and contradictions.'
                  : 'No findings here. All are resolved, or none were found.'}
              </div>
              {findings.length === 0 && (
                <button
                  onClick={runStoryAnalysis}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '6px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Scan Manuscript Now</span>
                </button>
              )}
            </div>
          ) : (
            filteredFindings.map(finding => {
              let badgeBg = 'var(--accent-gold-bg)';
              let badgeColor = 'var(--accent-gold)';
              if (finding.category === 'drafting_note') {
                badgeBg = 'rgba(245, 158, 11, 0.15)';
                badgeColor = '#f59e0b';
              } else if (finding.category === 'contradiction') {
                badgeBg = 'rgba(239, 68, 68, 0.12)';
                badgeColor = '#ef4444';
              } else if (finding.category === 'continuity') {
                badgeBg = 'rgba(139, 92, 246, 0.12)';
                badgeColor = '#8b5cf6';
              } else if (finding.category === 'expansion') {
                badgeBg = 'rgba(79, 128, 255, 0.12)';
                badgeColor = 'var(--accent-primary)';
              }

              return (
                <div
                  key={finding.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card)',
                    border: finding.status === 'unreviewed' ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    opacity: finding.status !== 'unreviewed' ? 0.75 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        display: 'inline-block',
                        marginBottom: '4px'
                      }}>
                        {finding.category.replace('_', ' ')} • {finding.confidence}
                      </span>
                      <h4 style={{ fontSize: '0.92rem', margin: 0, color: 'var(--text-main)', fontFamily: 'var(--font-display)' }}>
                        {finding.title}
                      </h4>
                    </div>

                    {finding.status !== 'unreviewed' && (
                      <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, textTransform: 'capitalize' }}>
                        ✓ {answerLabel(project.memoryVault.feedback, finding)}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {finding.summary}
                  </div>

                  {finding.evidencePassages && finding.evidencePassages.length > 0 && (
                    <div style={{ backgroundColor: 'var(--tag-bg)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Evidence from Manuscript:
                      </div>
                      {finding.evidencePassages.map((ev, i) => (
                        <PassageLink
                          key={i}
                          chapterId={ev.chapterId}
                          quote={ev.quote}
                          where={ev.chapterTitle}
                          commentText={commentTextFor(finding.title, finding.summary)}
                        />
                      ))}
                    </div>
                  )}

                  {finding.linkedFoundationCardId && (
                    <button
                      onClick={() => openFoundationCard(finding.linkedFoundationCardId!, project.storyBible.characters.find(c => c.name === finding.subject)?.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--accent-gold-text, var(--accent-gold))',
                        fontWeight: 600,
                        alignSelf: 'flex-start'
                      }}
                    >
                      <Compass size={13} />
                      <span>Explore the “{MUSE_FOUNDATION_CARDS.find(c => c.id === finding.linkedFoundationCardId)?.title ?? 'Foundations'}” card</span>
                    </button>
                  )}

                  {finding.loopId && (
                    project.plotThreads.some(t => t.loopId === finding.loopId) ? (
                      <button
                        onClick={() => setSidebarTab('threads')}
                        style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}
                      >
                        Tracked as a plot thread →
                      </button>
                    ) : (
                      <button
                        onClick={() => trackLoopAsThread(finding.loopId!)}
                        title="Keep an eye on this: link the passages that follow it and note what you expect"
                        style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}
                      >
                        Track as plot thread
                      </button>
                    )
                  )}

                  {finding.status !== 'unreviewed' && (
                    <button
                      onClick={() => respondToFinding(finding.id, 'unreviewed')}
                      title="Take your answer back and look at this again"
                      style={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                    >
                      Reopen
                    </button>
                  )}

                  {finding.status === 'unreviewed' && <FindingAnswer finding={finding} />}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* tab 2: story memory vault */}
      {activeSubTab === 'memory' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            What the analyzer read in your manuscript, and your decisions about it. Set aside anything it got wrong.
          </div>

          <ReadFacts
            facts={project.memoryVault?.readFacts ?? []}
            onIgnore={setStatementIgnored}
            onScan={runStoryAnalysis}
          />

          <PreferencesSection />

          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '6px' }}>Where they were last seen</div>
          <ReadPlaces places={project.memoryVault?.readPlaces ?? []} onIgnore={setStatementIgnored} />

          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '6px' }}>Who knows what</div>
          <ReadKnowledge knowledge={project.memoryVault?.readKnowledge ?? []} onIgnore={setStatementIgnored} />

          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '6px' }}>Decisions and established facts</div>
          {(project.memoryVault?.establishedFacts || []).map(fact => (
            <div key={fact.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}>{fact.subject}</span>
                <button onClick={() => deleteEstablishedFact(fact.id)} style={{ color: 'var(--text-muted)', padding: '2px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '4px' }}>{fact.claim}</div>
              {fact.sourceQuote && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Source: "{fact.sourceQuote}"
                </div>
              )}
              {fact.isIntentionalContradiction && (
                <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--badge-bg)', color: '#8b5cf6', padding: '2px 6px', borderRadius: 'var(--radius-sm)', marginTop: '4px', display: 'inline-block' }}>
                  Deliberate Author Choice
                </span>
              )}
            </div>
          ))}
          {(project.memoryVault?.establishedFacts || []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No established facts yet. Run the analyzer and confirm findings to build story memory.
            </div>
          )}
        </div>
      )}

      {/* tab 3: writing profile */}
      {activeSubTab === 'profile' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Stylistic patterns the analyzer has learned from your explanations. These teach the engine how <em>you</em> communicate emotions, clues, and subplots!
          </div>
          {(project.memoryVault?.authorStyleRules || []).map(rule => (
            <div key={rule.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>{rule.pattern}</div>
                <button onClick={() => deleteAuthorStyleRule(rule.id)} style={{ color: 'var(--text-muted)', padding: '2px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '6px' }}>{rule.meaning}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}>
                {rule.examplesCount} writer-confirmed example{rule.examplesCount > 1 ? 's' : ''}
              </div>
            </div>
          ))}
          {(project.memoryVault?.authorStyleRules || []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No style rules yet. Answer a finding with “Misread” and a note to build your author profile.
            </div>
          )}
        </div>
      )}

      {/* tab 4: lexicon customization */}
      {activeSubTab === 'lexicon' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, flexShrink: 0, padding: '8px 10px', backgroundColor: 'var(--tag-bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-gold)' }}>
            <strong style={{ color: 'var(--text-main)' }}>Your Analysis Vocabulary.</strong> Phrase lists the analyzer uses to read your prose. Edit any list; changes apply on the next scan. <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }}>defaults</span> means the built-in phrases.
          </div>

          {/* built-in categories */}
          {LEXICON_CATEGORIES.map(cat => {
            const isExpanded = expandedLexCat === cat.key;
            const activeList = getActiveList(cat.key);
            const usingDefaults = isUsingDefaults(cat.key);

            return (
              <div key={cat.key} style={{
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card)',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setExpandedLexCat(isExpanded ? null : cat.key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    textAlign: 'left',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{cat.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {cat.label}
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: usingDefaults ? 'var(--accent-gold-bg)' : 'var(--accent-primary)',
                          color: usingDefaults ? 'var(--accent-gold-text, var(--accent-gold))' : '#fff',
                          fontWeight: 700
                        }}>
                          {usingDefaults ? 'defaults' : 'custom'} • {activeList.length}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.description}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                    {/* reset to defaults button */}
                    {!usingDefaults && (
                      <button
                        onClick={() => resetToDefaults(cat.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          alignSelf: 'flex-end',
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          marginTop: '8px'
                        }}
                      >
                        <RotateCcw size={11} />
                        Reset to defaults
                      </button>
                    )}

                    {/* phrase chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: usingDefaults ? '8px' : '0' }}>
                      {activeList.map((phrase, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--tag-bg)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)',
                            maxWidth: '200px'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phrase}</span>
                          <button
                            onClick={() => removePhrase(cat.key, phrase)}
                            style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                            title={`Remove "${phrase}"`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* add phrase input */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <input
                        type="text"
                        placeholder={`Add phrase to ${cat.label.toLowerCase()}...`}
                        value={newPhraseInputs[cat.key] || ''}
                        onChange={e => setNewPhraseInputs(prev => ({ ...prev, [cat.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addPhrase(cat.key); }}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          fontSize: '0.78rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-paper)',
                          color: 'var(--text-main)'
                        }}
                      />
                      <button
                        onClick={() => addPhrase(cat.key)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--accent-gold-bg)',
                          color: 'var(--accent-gold-text, var(--accent-gold))',
                          border: '1px solid var(--accent-gold)',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* custom categories */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={13} />
              Custom Categories
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>
              Make your own phrase groups: motifs, dialect, genre items, anything to track.
            </div>

            {Object.entries(customCategories).map(([catName, phrases]) => {
              const catKey = `custom-${catName}`;
              const isExpanded = expandedLexCat === catKey;
              const phraseList = phrases as string[];
              return (
                <div key={catName} style={{
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-primary)',
                  backgroundColor: 'var(--bg-card)',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <button
                    onClick={() => setExpandedLexCat(isExpanded ? null : catKey)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                        {catName}
                        <span style={{
                          marginLeft: '6px',
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'rgba(79, 128, 255, 0.15)',
                          color: 'var(--accent-primary)',
                          fontWeight: 700
                        }}>custom • {phraseList.length}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); deleteCustomCategory(catName); }}
                        style={{ color: 'var(--text-muted)', padding: '2px' }}
                        title={`Delete "${catName}" category`}
                      >
                        <Trash2 size={13} />
                      </button>
                      {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                        {phraseList.map((phrase, i) => (
                          <span key={i} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'rgba(79, 128, 255, 0.08)',
                            border: '1px solid rgba(79, 128, 255, 0.25)',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)'
                          }}>
                            {phrase}
                            <button onClick={() => removeCustomPhrase(catName, phrase)} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {phraseList.length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No phrases yet — add some below.</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder={`Add phrase to "${catName}"...`}
                          value={expandedLexCat === catKey ? newCustomCatPhrase : ''}
                          onChange={e => setNewCustomCatPhrase(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addCustomPhrase(catName); }}
                          style={{
                            flex: 1,
                            padding: '5px 8px',
                            fontSize: '0.78rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-paper)',
                            color: 'var(--text-main)'
                          }}
                        />
                        <button onClick={() => addCustomPhrase(catName)} style={{
                          padding: '5px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(79, 128, 255, 0.12)',
                          color: 'var(--accent-primary)',
                          border: '1px solid var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* new custom category form */}
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
              backgroundColor: 'var(--tag-bg)',
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              <input
                type="text"
                placeholder="New category name (e.g. Magic Rules, Recurring Symbols...)"
                value={newCustomCatName}
                onChange={e => setNewCustomCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomCategory(); }}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '0.78rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-paper)',
                  color: 'var(--text-main)'
                }}
              />
              <button
                onClick={addCustomCategory}
                disabled={!newCustomCatName.trim()}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: newCustomCatName.trim() ? 'var(--accent-primary)' : 'var(--badge-bg)',
                  color: newCustomCatName.trim() ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={13} />
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
