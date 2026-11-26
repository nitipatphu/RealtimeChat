import { useState } from 'react';
import { apiGet } from '../../api';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';
import { formatDateTime } from '../../utils/format';
import { useCloseOnBack } from '../../utils/backButton';

function highlight(text, query) {
  if (!text) return null;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-amber-200 text-slate-900 rounded px-0.5">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export default function SearchModal({ groupId, users, onClose, onJump }) {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useCloseOnBack(onClose);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (query.trim().length < 2) {
      setError('พิมพ์คำค้นหาอย่างน้อย 2 ตัวอักษร');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/groups/' + groupId + '/search?q=' + encodeURIComponent(query.trim()));
      setResults(data);
      setSearchedQuery(query.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAuthor = (message) => {
    const user = (users || []).find(u => u.id === message.authorId);
    return user || { name: message.author, avatar: message.avatar };
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center pt-24 px-4 z-50"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[70vh] flex flex-col border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSearch} className="flex items-center gap-3 px-5 h-16 border-b border-slate-200">
          <Icon name="search" className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาข้อความหรือชื่อไฟล์ แล้วกด Enter"
            className="flex-1 text-base text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-400"
          />
          <kbd className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Esc</kbd>
        </form>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && <p className="text-center text-sm text-slate-400 py-10">กำลังค้นหา...</p>}
          {error && <p className="text-center text-sm text-red-600 py-10">{error}</p>}

          {!loading && !error && searchedQuery && results.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">ไม่พบข้อความที่มีคำว่า "{searchedQuery}"</p>
          )}
          {!loading && !searchedQuery && !error && (
            <p className="text-center text-sm text-slate-400 py-10">ค้นหาได้ทั้ง Channel, Project ที่คุณเห็น และข้อความส่วนตัว</p>
          )}

          {!loading && results.map(result => {
            const author = getAuthor(result.message);
            return (
              <button
                key={result.type + result.message.id}
                type="button"
                onClick={() => onJump(result)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Avatar src={author.avatar} name={author.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{author.name}</span>
                    <Badge tone="indigo">{result.roomName}</Badge>
                    <span className="text-xs text-slate-400">{formatDateTime(result.message.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 break-words line-clamp-2">{highlight(result.message.text, searchedQuery)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
