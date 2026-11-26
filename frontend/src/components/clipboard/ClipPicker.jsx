import { useState, useEffect, useRef } from 'react';
import { apiGet } from '../../api';
import Icon from '../ui/Icon';
import { inputBaseClass } from '../ui/Form';

export default function ClipPicker({ currentUser, onPick, onClose }) {
  const [clips, setClips] = useState(null);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    apiGet('/users/' + currentUser.id + '/clips')
      .then(data => setClips(data))
      .catch(() => setClips([]));
  }, [currentUser.id]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const query = search.trim().toLowerCase();
  const shown = (clips || []).filter(c => !query || c.text.toLowerCase().includes(query) || (c.title || '').toLowerCase().includes(query));

  return (
    <div ref={ref} className="absolute left-0 bottom-full mb-2 w-80 max-w-[85vw] bg-white border border-slate-200 rounded-xl shadow-xl z-30 flex flex-col">
      <div className="p-2 border-b border-slate-100">
        <p className="px-1 pb-1.5 text-xs font-semibold text-slate-500">แทรกจากคลิปบอร์ดของฉัน</p>
        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className={inputBaseClass + ' w-full h-8 text-sm'} />
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {clips === null && <p className="text-center text-sm text-slate-400 py-4">กำลังโหลด...</p>}
        {clips !== null && clips.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-4 px-3">ยังไม่มีข้อความ เพิ่มได้ที่เมนูคลิปบอร์ดด้านซ้าย</p>
        )}
        {shown.map(clip => (
          <button
            key={clip.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(clip.text)}
            className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50"
          >
            <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
              {clip.pinned && <Icon name="bookmark" className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
              {clip.title || clip.text.split('\n')[0].slice(0, 40)}
            </p>
            <p className="text-xs text-slate-500 truncate">{clip.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
