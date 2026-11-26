import { useEffect, useRef } from 'react';
import { EMOJIS } from '../../utils/constants';

export default function EmojiPicker({ onPick, onClose, position }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-40 w-[17rem] bg-white border border-slate-200 rounded-xl shadow-xl p-2 grid grid-cols-8 gap-0.5 ${position || 'right-0 top-full mt-1'}`}
    >
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="w-8 h-8 rounded-lg text-lg hover:bg-slate-100 transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
