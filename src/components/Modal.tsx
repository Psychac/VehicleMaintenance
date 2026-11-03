import { useEffect, type ReactNode } from 'react';
import { IconClose } from './icons';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Keep the page behind the dialog from scrolling while it is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" aria-label="Close" onClick={onClose}>
            <IconClose size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
