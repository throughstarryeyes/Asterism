// the first-run tour is shown once, on a brand new install. it can always be replayed from the menus.

export const TOUR_KEY = 'asterism_tour_seen';

export const tourSeen = (): boolean => {
  try { return localStorage.getItem(TOUR_KEY) !== null; } catch { return true; }
};

export const markTourSeen = () => {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* the tour just shows again next time */ }
};

export interface TourStep { title: string; body: string }

export const TOUR_STEPS: TourStep[] = [
  { title: 'Welcome to Asterism', body: 'A quiet place to write. Nereus, the sample on your home screen, is there to poke at: change it, break it, delete it. Nothing you do to it matters.' },
  { title: 'Write your way', body: 'Open a document to write in chapters, or in one flowing open draft. Select text to format it, and use the scene break button on the toolbar between scenes.' },
  { title: 'Keep track of your story', body: 'The sidebar holds your Story Bible, Cards, Threads, Timeline, Notes and Analyzer. Comments on the page show how notes and suggestions work. Every tool is free, always.' },
  { title: 'Change how you see it', body: 'The top bar switches between the editor, Zen, a typeset Book preview, the Map and Prompts. Sprint starts a timed write. Customize, in the menu, hides anything you do not use.' },
  { title: 'Quill Points', body: 'You earn points by writing, and you start with a few. They only buy looks, sounds and keepsakes in the Shop, never tools. The paint palette button changes your theme, and a document can wear its own.' },
  { title: 'Your writing is yours', body: 'It stays on this device, and nothing is sent to us. Use Back up and restore to save everything to a file, and to move to a new device. You can replay this tour from the menu.' },
];
