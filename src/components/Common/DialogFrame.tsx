import React from 'react';
import { useDialog } from './useDialog';

type Props = React.HTMLAttributes<HTMLDivElement> & { label: string; onClose: () => void };

// the full-screen backdrop of a modal, with dialog semantics and keyboard handling
export const DialogFrame: React.FC<Props> = ({ label, onClose, children, ...rest }) => {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} {...rest}>{children}</div>;
};
