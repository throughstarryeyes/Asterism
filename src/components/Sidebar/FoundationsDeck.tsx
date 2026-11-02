import React, { useEffect, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { MUSE_FOUNDATION_CARDS as DEFAULT_FOUNDATION_CARDS } from '../../data/museFoundations';
import { filterCards, tagCounts } from '../../services/muse/filters';
import type { FoundationCard, FoundationCategory, CardReflection, Project } from '../../types';
import { Sparkles, Compass, ChevronRight, Trash2, Bookmark, Dices, Search } from 'lucide-react';

// doc: a card deck kept as its own document; its character and chapter links come from the manuscript it is attached to
export const FoundationsDeck: React.FC<{ doc?: Project }> = ({ doc }) => {
  const { 
    project, 
    toolParent,
    updateToolDoc,
    notePlanning,
    showToast,
    saveReflection: saveToProject, 
    deleteReflection: deleteFromProject,
    checkBadgeMilestones,
    focusedCard,
    clearFocusedCard
  } = useAsterism();

  const reflections = doc ? doc.reflections : project.reflections;
  const linkSource = doc ? toolParent : project;
  const characters = linkSource?.storyBible.characters ?? [];
  const chapters = linkSource?.chapters ?? [];
  const saveReflection = (r: CardReflection) => {
    if (!doc) return saveToProject(r);
    updateToolDoc({ reflections: doc.reflections.some(x => x.id === r.id) ? doc.reflections.map(x => (x.id === r.id ? r : x)) : [...doc.reflections, r] });
    showToast('Story Foundation reflection saved', 'success');
    notePlanning('Story Foundation Explored');
  };
  const deleteReflection = (id: string) => {
    if (!doc) return deleteFromProject(id);
    updateToolDoc({ reflections: doc.reflections.filter(x => x.id !== id) });
    showToast('Reflection removed', 'info');
  };

  const [activeCategory, setActiveCategory] = useState<FoundationCategory | 'all'>('all');
  const [selectedCard, setSelectedCard] = useState<FoundationCard>(DEFAULT_FOUNDATION_CARDS[0]);
  const [reflectionText, setReflectionText] = useState('');
  const [linkedCharId, setLinkedCharId] = useState<string>('');
  const [linkedChapId, setLinkedChapId] = useState<string>('');
  const [showSavedList, setShowSavedList] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // a suggestion sent the writer here: show that card, ready to reflect on for that character
  useEffect(() => {
    if (!focusedCard) return;
    const card = DEFAULT_FOUNDATION_CARDS.find(c => c.id === focusedCard.cardId);
    if (card) {
      setSelectedCard(card);
      setActiveCategory(card.category);
      setActiveTags([]);
      setSearch('');
      setShowSavedList(false);
      setLinkedCharId(focusedCard.characterId ?? '');
    }
    clearFocusedCard();
  }, [focusedCard, clearFocusedCard]);

  const categories: Array<{ id: FoundationCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'autopsy', label: 'Autopsy' },
    { id: 'faultline', label: 'Faultlines' },
    { id: 'characters', label: 'Characters' },
    { id: 'world', label: 'Setting' },
    { id: 'descent', label: 'Descent' },
    { id: 'tropes', label: 'Tropes' },
    { id: 'narration', label: 'Narration' }
  ];

  const filteredCards = filterCards(DEFAULT_FOUNDATION_CARDS, { category: activeCategory, tags: activeTags, search });
  // offer the tags that exist in this category (not ones that would match nothing).
  const tagOptions = tagCounts(filterCards(DEFAULT_FOUNDATION_CARDS, { category: activeCategory }), 14);
  // how many cards the list shows; it starts short so the page is not a wall of text
  const PAGE = 10;
  const [shown, setShown] = useState(PAGE);
  // cards of these kinds all share one title ("Who they are"), so the list shows their text instead
  const sharesTitle = (c: FoundationCard) => c.category === 'characters' || c.category === 'world' || c.category === 'descent';

  const pickRandom = () => {
    if (!filteredCards.length) return;
    setSelectedCard(filteredCards[Math.floor(Math.random() * filteredCards.length)]);
  };
  const toggleTag = (tag: string) => { setActiveTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])); setShown(PAGE); };
  const chooseCategory = (id: FoundationCategory | 'all') => { setActiveCategory(id); setActiveTags([]); setShown(PAGE); };

  const handleSaveReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionText.trim()) return;

    const newReflection: CardReflection = {
      id: `ref-${Date.now()}`,
      cardId: selectedCard.id,
      cardTitle: selectedCard.title,
      category: selectedCard.category,
      reflectionText: reflectionText.trim(),
      linkedCharacterId: linkedCharId || undefined,
      linkedChapterId: linkedChapId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveReflection(newReflection);
    setReflectionText('');
    checkBadgeMilestones();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Story Foundations
          </span>
        </div>
        <button
          onClick={() => setShowSavedList(!showSavedList)}
          style={{
            fontSize: '0.75rem',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: showSavedList ? 'var(--accent-gold-bg)' : 'var(--badge-bg)',
            color: showSavedList ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Bookmark size={13} />
          <span>Reflections ({reflections.length})</span>
        </button>
      </div>

      {showSavedList ? (
        /* saved reflections list */
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reflections.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No saved reflections yet. Pick a card below and jot your thoughts!
            </div>
          ) : (
            reflections.map(ref => {
              const char = characters.find(c => c.id === ref.linkedCharacterId);
              const chap = chapters.find(c => c.id === ref.linkedChapterId);

              return (
                <div 
                  key={ref.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}>
                      {ref.cardTitle}
                    </div>
                    <button
                      onClick={() => deleteReflection(ref.id)}
                      style={{ padding: '2px', color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    "{ref.reflectionText}"
                  </div>

                  <div style={{ display: 'flex', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginTop: '4px' }}>
                    {char && <span style={{ backgroundColor: 'var(--tag-bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>Character: {char.name}</span>}
                    {chap && <span style={{ backgroundColor: 'var(--tag-bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>Chapter: {chap.title}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* card deck & interactive reflection studio */
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* search and random */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setShown(PAGE); }}
                placeholder="Search cards…"
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 28px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
              />
            </div>
            <button
              onClick={pickRandom}
              disabled={!filteredCards.length}
              title="Pick a random card from what's showing"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, opacity: filteredCards.length ? 1 : 0.5 }}
            >
              <Dices size={14} /> Random
            </button>
          </div>

          {/* category pills filter */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => chooseCategory(cat.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  backgroundColor: activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--badge-bg)',
                  color: activeCategory === cat.id ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {tagOptions.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {tagOptions.map(({ tag, count }) => {
                const on = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem',
                      border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                      background: on ? 'var(--accent-gold-bg)' : 'transparent', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
                    }}
                  >
                    {tag} <span style={{ opacity: 0.6 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* active question card */}
          <div
            className="animate-fade-in"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-paper)',
              border: '1px solid var(--accent-gold)',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>
                {selectedCard.category}
              </span>
            </div>

            <h3 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-display)', marginBottom: '8px', color: 'var(--text-main)' }}>
              {selectedCard.title}
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '14px', fontStyle: 'italic' }}>
              "{selectedCard.prompt}"
            </p>

            {/* deepening questions (only some cards have them) */}
            {selectedCard.deepeningQuestions.length > 0 && <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Follow-up Lines of Thought:
              </div>
              <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
                {selectedCard.deepeningQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>}

            {/* reflection form */}
            <form onSubmit={handleSaveReflection} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                placeholder="Write your story reflection or revelation here..."
                value={reflectionText}
                onChange={e => setReflectionText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '0.85rem',
                  resize: 'vertical'
                }}
              />

              {/* link to chapter / character */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <select aria-label="Link to a character"
                  value={linkedCharId}
                  onChange={e => setLinkedCharId(e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.78rem' }}
                >
                  <option value="">Link to Character...</option>
                  {characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select aria-label="Link to a chapter"
                  value={linkedChapId}
                  onChange={e => setLinkedChapId(e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.78rem' }}
                >
                  <option value="">Link to Chapter...</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!reflectionText.trim()}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: reflectionText.trim() ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--border-subtle)',
                  color: reflectionText.trim() ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: reflectionText.trim() ? 'pointer' : 'default'
                }}
              >
                <Sparkles size={14} />
                <span>Save Reflection</span>
              </button>
            </form>
          </div>

          {/* cards carousel / selection list */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Explore Other Cards ({filteredCards.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredCards.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No cards match. Try fewer tags or a different search.</div>
              )}
              {filteredCards.slice(0, shown).map(c => {
                const isSelected = c.id === selectedCard.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCard(c)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--accent-gold-bg)' : 'var(--bg-card)',
                      border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      {sharesTitle(c) ? (
                        <>
                          <div style={{ color: 'var(--text-main)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.prompt}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.title}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.title}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.category}</div>
                        </>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: isSelected ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-muted)' }} />
                  </div>
                );
              })}
              {filteredCards.length > shown && (
                <button onClick={() => setShown(n => n + PAGE)} style={{ fontSize: '0.78rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>
                  Show {Math.min(PAGE, filteredCards.length - shown)} more ({filteredCards.length - shown} left)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
