// ── Komponent Modal (okno dialogowe) ─────────────────────
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useAnimatedMount } from '../../utils/useAnimatedMount';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useAnimatedMount(isOpen, 350);

  // Zamknij modal klawiszem Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Zablokuj przewijanie strony gdy modal jest otwarty (działa na iOS i Android)
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!mounted) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Tło */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop',
          visible ? 'modal-visible' : 'modal-hidden'
        )}
        onClick={onClose}
      />

      {/* Treść modalu */}
      <div className={clsx(
        'relative w-full rounded-2xl shadow-2xl modal-content',
        'bg-white dark:bg-slate-800',
        'border border-gray-200 dark:border-slate-700',
        visible ? 'modal-visible' : 'modal-hidden',
        sizeClasses[size]
      )}>
        {/* Nagłówek */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Zawartość */}
        <div className="overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  );
}
