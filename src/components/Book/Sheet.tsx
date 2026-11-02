import React from 'react';
import type { BookDesign, Paper } from '../../services/book/design';
import { contentBox, isRecto, textLeft } from '../../services/book/design';
import type { PageKind } from '../../services/book/source';
import { coverPaint, findCover, type CustomCover } from '../../services/looks';

// one face of the book: a page, the cover, or the blank sheet inside the cover. sizes are in inches.

export interface FaceBase { design: BookDesign; vars: Record<string, string>; paper: Paper }

export const PageSheet: React.FC<FaceBase & { index: number; html: string; kind: PageKind; number: number | null; head: string; drop?: boolean }> = ({ design, vars, paper, index, html, kind, number, head, drop }) => {
  const box = contentBox(design);
  const left = textLeft(design, index);
  const showNumber = number !== null && design.numbers !== 'none' && (kind === 'body' || kind === 'chapter');
  const outsideRight = isRecto(index);
  return (
    <div className="bk-sheet" style={{ ...vars, width: `${design.width}in`, height: `${design.height}in`, background: paper.page, color: paper.ink }}>
      {kind === 'body' && head && design.head !== 'none' && (
        <div className="bk-run" style={{ top: `${design.top * 0.45}in`, left: `${left}in`, width: `${box.w}in` }}>{head}</div>
      )}
      <div className={`bk-pagebody bk-text${drop ? ' bk-drop' : ''}`} lang="en" style={{ left: `${left}in`, top: `${design.top}in`, width: `${box.w}in`, height: `${box.h}in` }} dangerouslySetInnerHTML={{ __html: html }} />
      {showNumber && (
        <div className="bk-folio" style={{ bottom: `${design.bottom * 0.4}in`, left: `${left}in`, width: `${box.w}in`, textAlign: design.numbers === 'center' ? 'center' : outsideRight ? 'right' : 'left' }}>{number}</div>
      )}
    </div>
  );
};

export const BlankSheet: React.FC<FaceBase & { tone?: number }> = ({ design, paper, tone = 0 }) => (
  <div className="bk-sheet" style={{ width: `${design.width}in`, height: `${design.height}in`, background: paper.page, color: paper.ink, filter: tone ? `brightness(${1 - tone})` : undefined }} />
);

export const CoverSheet: React.FC<FaceBase & { title: string; author: string; coverId: string; custom?: CustomCover[]; imageUrl?: string }> = ({ design, title, author, coverId, custom, imageUrl }) => {
  const cover = findCover(coverId, custom);
  const plain = cover.id === 'plain';
  const paint: React.CSSProperties = imageUrl ? { background: '#111' } : plain ? { background: '#2b2a3a' } : coverPaint(cover);
  const ink = plain ? '#e9dcb4' : cover.ink;
  return (
    <div className="bk-sheet" style={{ width: `${design.width}in`, height: `${design.height}in`, ...paint, color: ink, borderRadius: '2px 6px 6px 2px' }}>
      {imageUrl ? (
        <img src={imageUrl} alt="Book cover" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ position: 'absolute', inset: `${design.width * 0.06}in`, border: `1.5px solid ${ink}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: `${design.height * 0.08}in ${design.width * 0.07}in`, textAlign: 'center' }}>
          <div style={{ fontSize: `${design.width * 0.07}in`, letterSpacing: '0.4em', opacity: 0.9 }}>{plain ? '❦' : cover.glyph}</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 700, fontSize: `${design.width * (title.length > 28 ? 0.085 : 0.115)}in`, lineHeight: 1.12, letterSpacing: '0.02em', overflowWrap: 'anywhere' }}>{title}</div>
          </div>
          <div style={{ fontSize: `${design.width * 0.052}in`, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{author}</div>
        </div>
      )}
      {/* the spine side of the cover is a little darker, so it reads as a book */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,0.08))' }} />
    </div>
  );
};
