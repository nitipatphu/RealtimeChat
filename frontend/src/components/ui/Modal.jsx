import { useEffect } from 'react';
import { IconButton } from './Button';
import { useCloseOnBack } from '../../utils/backButton';

export default function Modal({ title, description, onClose, children, footer, width }) {
  useCloseOnBack(onClose);
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${width || 'max-w-md'} max-h-[90vh] flex flex-col border border-slate-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
          <IconButton icon="x" title="ปิด" onClick={onClose} size="sm" />
        </div>

        <div className="px-6 pb-5 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
