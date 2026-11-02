// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorSurface } from '../EditorSurface';

// the app shows one chapter at a time, and moving to another chapter hands the editor a different chapter. that must never throw.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const errors: unknown[] = [];

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  errors.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
  window.addEventListener('error', e => errors.push(e.error));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const show = (chapterId: string, html: string, onChange = vi.fn()) => act(() => {
  root.render(<EditorSurface chapterId={chapterId} scope="p1" html={html} onChange={onChange} />);
});
const text = () => host.querySelector('.ProseMirror')?.textContent ?? '';
const realErrors = () => errors.filter(e => !String(e).includes('not wrapped in act'));

describe('moving between chapters', () => {
  it('shows each chapter\'s own text, going forward and back, without an error', () => {
    show('c1', '<p>first chapter</p>');
    expect(text()).toBe('first chapter');
    show('c2', '<p>second chapter</p>');
    expect(text()).toBe('second chapter');
    show('c1', '<p>first chapter</p>');
    expect(text()).toBe('first chapter');
    for (let i = 0; i < 6; i++) { show('c2', '<p>second chapter</p>'); show('c1', '<p>first chapter</p>'); }
    expect(realErrors()).toEqual([]);
  });

  it('shows new text for the same chapter when it changes somewhere else', () => {
    show('c1', '<p>one</p>');
    show('c1', '<p>one, restored from history</p>');
    expect(text()).toBe('one, restored from history');
    expect(realErrors()).toEqual([]);
  });

  it('does not take the old chapter\'s text for a change in the new one', () => {
    const onChange = vi.fn();
    show('c1', '<p>alpha</p>', onChange);
    show('c2', '<p>beta</p>', onChange);
    expect(text()).toBe('beta');
    // nothing was typed, so nothing should have been reported as a change
    expect(onChange).not.toHaveBeenCalled();
  });
});
