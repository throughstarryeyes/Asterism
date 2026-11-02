import { useSyncExternalStore } from 'react';

// the writer's own words (names, invented places, slang) that the spell checker should leave alone. kept on this device.

const KEY = 'asterism_word_bank';
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    cache = Array.isArray(raw) ? raw.filter((w): w is string => typeof w === 'string' && !!w.trim()) : [];
  } catch { cache = []; }
  return cache;
}

function write(next: string[]) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* it stays for this session */ }
  listeners.forEach(l => l());
}

export const getWordBank = (): string[] => read();
export const inWordBank = (word: string): boolean => read().some(w => w.toLowerCase() === word.trim().toLowerCase());

export function addToWordBank(word: string): boolean {
  const w = word.trim();
  if (!w || w.length > 60 || inWordBank(w)) return false;
  write([...read(), w].sort((a, b) => a.localeCompare(b)));
  return true;
}

export function removeFromWordBank(word: string) {
  write(read().filter(w => w.toLowerCase() !== word.trim().toLowerCase()));
}

export function subscribeWordBank(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const useWordBank = (): string[] => useSyncExternalStore(subscribeWordBank, getWordBank);
