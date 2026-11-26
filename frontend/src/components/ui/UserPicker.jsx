import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import Avatar from './Avatar';
import Icon from './Icon';
import { inputClass } from './Form';

const MAX_RESULTS = 8;

export default function UserPicker({ users, searchFilter, value, onChange, label, placeholder, initialUser }) {
  const [search, setSearch] = useState('');
  const [remoteResults, setRemoteResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickedUser, setPickedUser] = useState(initialUser || null);

  const isRemote = !users;
  const query = search.trim().toLowerCase();

  useEffect(() => {
    if (!isRemote || !query) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      apiGet('/admin/users/search?limit=' + MAX_RESULTS + '&q=' + encodeURIComponent(query) + (searchFilter || ''))
        .then(data => {
          if (!cancelled) setRemoteResults(data);
        })
        .catch(() => {
          if (!cancelled) setRemoteResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRemote, query, searchFilter]);

  let selected = null;
  if (value) {
    if (users) {
      selected = users.find(u => u.id === value) || null;
    } else if (pickedUser && pickedUser.id === value) {
      selected = pickedUser;
    }
  }

  let results = [];
  if (query) {
    if (isRemote) {
      results = remoteResults;
    } else {
      results = users.filter(u => u.name.toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
    }
  }
  const shown = results.slice(0, MAX_RESULTS);

  const pick = (user) => {
    setPickedUser(user);
    onChange(user.id, user);
    setSearch('');
    setRemoteResults([]);
  };

  const clear = () => {
    onChange('', null);
    setSearch('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (shown.length > 0) pick(shown[0]);
    }
    if (e.key === 'Escape') {
      setSearch('');
    }
  };

  return (
    <div className="block">
      {label && <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>}

      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2">
          <Avatar src={selected.avatar} name={selected.name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{selected.name}</p>
            {selected.email && <p className="text-xs text-slate-500 truncate">{selected.email}</p>}
          </div>
          <button type="button" onClick={clear} title="เปลี่ยนผู้ใช้" className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass + ' pl-9'}
            placeholder={placeholder || 'พิมพ์อีเมลหรือชื่อเพื่อค้นหา...'}
          />
          {query && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
              {shown.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => pick(user)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{user.name}</span>
                    <span className="block text-xs text-slate-500 truncate">{user.email}</span>
                  </span>
                </button>
              ))}
              {loading && shown.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">กำลังค้นหา...</p>}
              {!loading && results.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">ไม่พบผู้ใช้</p>}
              {!isRemote && results.length > MAX_RESULTS && (
                <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
                  พบ {results.length} คน แสดง {MAX_RESULTS} คนแรก พิมพ์ให้ละเอียดขึ้นเพื่อกรอง
                </p>
              )}
              {isRemote && results.length >= MAX_RESULTS && (
                <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">แสดง {MAX_RESULTS} คนแรก พิมพ์ให้ละเอียดขึ้นเพื่อกรอง</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
