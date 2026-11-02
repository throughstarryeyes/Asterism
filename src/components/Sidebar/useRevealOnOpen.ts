import { useEffect, useRef } from 'react';

// bring a form into view when it opens, so editing a card low in the list does not leave the writer scrolled past it
// `which` changes when a different card is opened while a form is already showing
export function useRevealOnOpen<T extends HTMLElement>(open: boolean, which = '') {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [open, which]);
  return ref;
}
