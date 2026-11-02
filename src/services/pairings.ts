import { isSystemFont, systemStack } from './systemFonts';

// a pairing is a body font for the writing and a heading font for titles. fonts come from Google Fonts when online,
// and fall back to a serif when not.

export interface Pairing {
  id: string;
  name: string;
  body: string;
  heading: string; // '' keeps the theme's own heading font
  cost: number;
  description: string;
}

export const FREE_PAIRING = 'classic';

export const PAIRINGS: Pairing[] = [
  { id: 'classic', name: 'Classic', body: 'Lora', heading: '', cost: 0, description: 'Lora for the writing, your theme for the titles.' },
  { id: 'readable', name: 'Easy reading', body: 'Atkinson Hyperlegible', heading: 'Atkinson Hyperlegible', cost: 0, description: 'Shaped so letters are hard to mix up. Good for dyslexia and low vision.' },
  { id: 'storybook', name: 'Storybook', body: 'Merriweather', heading: 'Playfair Display', cost: 40, description: 'Sturdy and warm under elegant titles.' },
  { id: 'modern', name: 'Modern novel', body: 'Source Serif 4', heading: 'Outfit', cost: 40, description: 'A clean serif with a friendly sans for titles.' },
  { id: 'cozy', name: 'Cozy notebook', body: 'Crimson Pro', heading: 'Caveat', cost: 50, description: 'Book text with handwritten headings.' },
  { id: 'typewriter', name: 'Typewriter', body: 'Courier Prime', heading: 'Special Elite', cost: 50, description: 'Manuscript courier under a worn typewriter title.' },
  { id: 'gothic', name: 'Gothic', body: 'EB Garamond', heading: 'Cinzel Decorative', cost: 60, description: 'Old-style text under carved capitals.' },
  { id: 'romance', name: 'Romance', body: 'Cormorant Garamond', heading: 'Great Vibes', cost: 60, description: 'Delicate text with a flowing script.' },
  { id: 'scifi', name: 'Starship', body: 'IBM Plex Serif', heading: 'Orbitron', cost: 60, description: 'A technical serif under wide, squared titles.' },
];

// a pairing the writer made: any Google font name for the writing and one for titles
export interface CustomPairing { id: string; name: string; body: string; heading: string }

const fontName = (v: unknown, fallback: string) => (typeof v === 'string' ? v.replace(/["'<>{};\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) : '') || fallback;

export function cleanPairing(raw: Partial<CustomPairing> & { id: string }): CustomPairing {
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My fonts',
    body: fontName(raw.body, 'Lora'),
    heading: fontName(raw.heading, ''),
  };
}

const asPairing = (c: CustomPairing): Pairing => ({ ...c, cost: 0, description: 'Made by you.' });

export const findPairing = (id: string | undefined, custom: CustomPairing[] = []): Pairing => {
  const mine = custom.find(c => c.id === id);
  return mine ? asPairing(mine) : PAIRINGS.find(p => p.id === id) ?? PAIRINGS[0];
};

// the pairing that matches the fonts in use, if any
export const pairingFor = (body: string, heading: string | undefined, custom: CustomPairing[] = []) =>
  [...custom.map(asPairing), ...PAIRINGS].find(p => p.body === body && p.heading === (heading ?? ''));

export const fontStack = (family: string) => (isSystemFont(family) ? systemStack(family) : `"${family.replace(/"/g, '')}", Georgia, serif`);
