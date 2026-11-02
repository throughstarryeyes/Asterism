import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  X, 
  Quote, 
  Lightbulb, 
  Check, 
  CornerDownRight 
} from 'lucide-react';

interface Props {
  onClose?: () => void;
  isFloating?: boolean;
}

export const CommentsDrawer: React.FC<Props> = ({ onClose, isFloating = false }) => {
  const { 
    project, 
    activeChapterId, 
    activeChapter, 
    addComment, 
    toggleCommentResolved, 
    deleteComment,
    activeCommentId,
    setActiveCommentId,
    setActiveChapterId,
    acceptSuggestion,
    rejectSuggestion
  } = useAsterism();

  const [filter, setFilter] = useState<'all' | 'open' | 'suggestions' | 'resolved'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<'comment' | 'suggestion'>('comment');
  const [newNote, setNewNote] = useState('');
  const [newPassage, setNewPassage] = useState('');
  const [newSuggestedText, setNewSuggestedText] = useState('');

  const chapterComments = (project.comments || []).filter(c => {
    const matchesChap = c.chapterId === activeChapterId;
    if (filter === 'open') return matchesChap && !c.resolved;
    if (filter === 'suggestions') return matchesChap && c.type === 'suggestion';
    if (filter === 'resolved') return matchesChap && c.resolved;
    return matchesChap;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    addComment(
      newPassage.trim() || 'Chapter Observation',
      newNote.trim(),
      addMode,
      addMode === 'suggestion' ? newSuggestedText.trim() : undefined
    );

    setNewNote('');
    setNewPassage('');
    setNewSuggestedText('');
    setIsAdding(false);
  };

  const handleCardClick = (commentId: string) => {
    const targetComment = project.comments.find(c => c.id === commentId);
    if (targetComment && targetComment.chapterId !== activeChapterId) {
      setActiveChapterId(targetComment.chapterId);
    }
    setActiveCommentId(activeCommentId === commentId ? null : commentId);
  };

  // scroll active comment card into view in drawer
  React.useEffect(() => {
    if (activeCommentId) {
      const timer = setTimeout(() => {
        const card = document.getElementById(`comment-card-${activeCommentId}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [activeCommentId]);

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: isFloating ? 'var(--bg-paper)' : 'transparent',
        padding: isFloating ? '20px' : '0'
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={17} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notes & Suggestions ({chapterComments.length})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsAdding(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-gold-bg)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>New</span>
          </button>

          {isFloating && onClose && (
            <button onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '4px', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['all', 'open', 'suggestions', 'resolved'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.74rem',
              fontWeight: 500,
              textTransform: 'capitalize',
              backgroundColor: filter === tab ? 'var(--accent-primary)' : 'var(--badge-bg)',
              color: filter === tab ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* add form */}
      {isAdding && (
        <form onSubmit={handleAdd} style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>New Margin Entry</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setAddMode('comment')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: addMode === 'comment' ? 'var(--accent-gold-bg)' : 'transparent',
                  color: addMode === 'comment' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                  border: addMode === 'comment' ? '1px solid var(--accent-gold)' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                Note
              </button>
              <button
                type="button"
                onClick={() => setAddMode('suggestion')}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: addMode === 'suggestion' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: addMode === 'suggestion' ? '#10b981' : 'var(--text-secondary)',
                  border: addMode === 'suggestion' ? '1px solid #10b981' : '1px solid transparent',
                  cursor: 'pointer'
                }}
              >
                Suggestion
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Target text excerpt (optional)..."
            value={newPassage}
            onChange={e => setNewPassage(e.target.value)}
            style={{ padding: '6px 8px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
          />

          <textarea
            placeholder={addMode === 'suggestion' ? "Reason for suggestion..." : "Critique, voice note, continuity observation..."}
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            rows={2}
            autoFocus
            required
            style={{ padding: '6px 8px', fontSize: '0.8rem', resize: 'vertical', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
          />

          {addMode === 'suggestion' && (
            <textarea
              placeholder="Proposed replacement text..."
              value={newSuggestedText}
              onChange={e => setNewSuggestedText(e.target.value)}
              rows={2}
              style={{ padding: '6px 8px', fontSize: '0.8rem', resize: 'vertical', borderRadius: 'var(--radius-sm)', border: '1px solid #10b981', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
            />
          )}

          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <button type="submit" style={{ flex: 1, padding: '6px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
              Save Entry
            </button>
            <button type="button" onClick={() => setIsAdding(false)} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* comments list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {chapterComments.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            No notes on this chapter yet. Highlight text to add a comment or suggestion.
          </div>
        ) : (
          chapterComments.map(comment => {
            const isActive = activeCommentId === comment.id;
            const isSuggestion = comment.type === 'suggestion';

            return (
              <div
                key={comment.id}
                id={`comment-card-${comment.id}`}
                className="comment-shaped"
                onClick={() => handleCardClick(comment.id)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive 
                    ? 'var(--accent-gold-bg)' 
                    : comment.resolved 
                      ? 'var(--tag-bg)' 
                      : 'var(--bg-card)',
                  border: isActive 
                    ? '1.5px solid var(--accent-gold)' 
                    : isSuggestion
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid var(--border-subtle)',
                  boxShadow: isActive ? '0 0 14px rgba(201, 147, 59, 0.25)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  opacity: comment.resolved ? 0.75 : 1,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {/* header: author & suggestion badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isSuggestion ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                        <Lightbulb size={11} />
                        <span>Suggestion</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>
                        {comment.author}
                      </span>
                    )}
                    {isActive && (
                      <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', color: '#fff', fontWeight: 700 }}>
                        Active
                      </span>
                    )}
                  </div>

                  <span style={{ color: 'var(--text-muted)' }}>
                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* quoted passage */}
                {comment.passageText && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontStyle: 'italic', display: 'flex', alignItems: 'baseline', gap: '4px', backgroundColor: 'var(--tag-bg)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                    <Quote size={11} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{comment.passageText}"
                    </span>
                  </div>
                )}

                {/* comment observation text */}
                <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                  {comment.commentText}
                </div>

                {/* suggestion diff & accept/reject actions */}
                {isSuggestion && (
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-sm)', padding: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CornerDownRight size={12} />
                      <span>
                        {comment.passageText && comment.suggestedText
                          ? 'Proposed Replacement:'
                          : comment.suggestedText
                            ? 'Proposed Insertion:'
                            : 'Proposed Deletion:'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '3px', fontWeight: 500 }}>
                      {comment.passageText && comment.suggestedText && (
                        <span>
                          <del style={{ color: 'var(--text-muted)' }}>"{comment.passageText}"</del> → <ins style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>"{comment.suggestedText}"</ins>
                        </span>
                      )}
                      {!comment.passageText && comment.suggestedText && (
                        <ins style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>
                          + Add: "{comment.suggestedText}"
                        </ins>
                      )}
                      {comment.passageText && !comment.suggestedText && (
                        <del style={{ color: 'var(--text-muted)' }}>
                          - Delete: "{comment.passageText}"
                        </del>
                      )}
                    </div>

                    {!comment.resolved && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // immediately unwrap/remove in active DOM if visible
                            const dels = document.querySelectorAll(`del[data-suggestion-id="${comment.id}"], del[data-comment-id="${comment.id}"]`);
                            const inss = document.querySelectorAll(`ins[data-suggestion-id="${comment.id}"], ins[data-comment-id="${comment.id}"]`);

                            if (inss.length > 0) {
                              dels.forEach(d => d.remove());
                              inss.forEach(ins => {
                                const parent = ins.parentNode;
                                while (ins.firstChild) parent?.insertBefore(ins.firstChild, ins);
                                ins.remove();
                              });
                            } else if (dels.length > 0) {
                              if (comment.suggestedText) {
                                dels.forEach((del, idx) => {
                                  if (idx === 0) {
                                    const textNode = document.createTextNode(comment.suggestedText!);
                                    del.parentNode?.insertBefore(textNode, del);
                                  }
                                  del.remove();
                                });
                              } else {
                                dels.forEach(d => d.remove());
                              }
                            }
                            acceptSuggestion(comment.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: 'var(--shadow-xs)'
                          }}
                        >
                          <Check size={12} />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // immediately remove ins and unwrap del in active DOM
                            const inss = document.querySelectorAll(`ins[data-suggestion-id="${comment.id}"], ins[data-comment-id="${comment.id}"]`);
                            inss.forEach(ins => ins.remove());
                            const dels = document.querySelectorAll(`del[data-suggestion-id="${comment.id}"], del[data-comment-id="${comment.id}"]`);
                            dels.forEach(del => {
                              const parent = del.parentNode;
                              while (del.firstChild) parent?.insertBefore(del.firstChild, del);
                              del.remove();
                            });
                            rejectSuggestion(comment.id);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--tag-bg)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* card footer: status & delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCommentResolved(comment.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: comment.resolved ? '#10b981' : 'var(--text-secondary)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: 0
                    }}
                    title={comment.resolved ? 'Mark as open' : 'Mark as resolved'}
                  >
                    {comment.resolved ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    <span>{comment.resolved ? (comment.status === 'accepted' ? 'Accepted' : comment.status === 'rejected' ? 'Rejected' : 'Resolved') : 'Open'}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteComment(comment.id);
                    }}
                    style={{ padding: '2px', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
                    title="Delete note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
