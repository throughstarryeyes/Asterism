import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { MessageSquarePlus, Quote } from 'lucide-react';

interface Props {
  chapterId?: string;
  quote: string;
  // where it is from, shown after the quote ("Chapter 3").
  where?: string;
  // what to write if the writer adds it as a comment.
  commentText: string;
  // hide the comment button where it would not make sense.
  allowComment?: boolean;
}

// a quoted passage from the manuscript. clicking it opens the chapter and shows
// the passage in the editor; the small button turns it into a comment there.
export const PassageLink: React.FC<Props> = ({ chapterId, quote, where, commentText, allowComment = true }) => {
  const { jumpToPassage, addCommentAtPassage } = useAsterism();
  const canJump = !!chapterId;

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <button
        disabled={!canJump}
        onClick={() => chapterId && jumpToPassage(chapterId, quote)}
        title={canJump ? 'Show this in the document' : undefined}
        style={{
          flex: 1, textAlign: 'left', display: 'flex', alignItems: 'baseline', gap: '4px', padding: '1px 2px',
          fontSize: '0.76rem', fontStyle: 'italic', color: 'var(--text-main)',
          cursor: canJump ? 'pointer' : 'default', borderRadius: 'var(--radius-sm)',
        }}
      >
        <Quote size={10} style={{ flexShrink: 0, color: 'var(--accent-gold-text, var(--accent-gold))' }} />
        <span style={{ textDecoration: canJump ? 'underline dotted' : 'none', textUnderlineOffset: '3px' }}>
          {where && <strong>{where}: </strong>}“{quote}”
        </span>
      </button>
      {canJump && allowComment && (
        <button
          onClick={() => addCommentAtPassage(chapterId!, quote, commentText)}
          title="Add as a comment on this passage"
          style={{ flexShrink: 0, display: 'flex', color: 'var(--text-secondary)', padding: '2px' }}
        >
          <MessageSquarePlus size={13} />
        </button>
      )}
    </div>
  );
};
