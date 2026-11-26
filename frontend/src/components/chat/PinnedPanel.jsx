import { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import ChatMessage from './ChatMessage';
import { IconButton } from '../ui/Button';
import { EmptyState } from '../ui/Card';
import { useCloseOnBack } from '../../utils/backButton';

export default function PinnedPanel({ url, users, group, currentUser, reloadKey, onClose, onTogglePin }) {
  const [pins, setPins] = useState(null);
  const [error, setError] = useState('');
  useCloseOnBack(onClose);

  useEffect(() => {
    apiGet(url)
      .then(data => setPins(data))
      .catch(err => setError(err.message));
  }, [url, reloadKey]);

  return (
    <aside className="fixed inset-0 z-40 md:static md:z-auto w-full md:w-[380px] border-l border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div>
          <p className="text-sm font-semibold text-slate-900">ข้อความที่ปักหมุด</p>
          <p className="text-xs text-slate-500">{pins ? pins.length + ' ข้อความ' : 'กำลังโหลด...'}</p>
        </div>
        <IconButton icon="x" title="ปิด" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-1">
        {error && <p className="text-sm text-red-600 px-3">{error}</p>}
        {pins && pins.length === 0 && (
          <EmptyState icon="bookmark" title="ยังไม่มีข้อความที่ปักหมุด" text="ผู้ที่มีสิทธิ์จัดการข้อความสามารถปักหมุดข้อความสำคัญไว้ที่นี่" />
        )}
        {(pins || []).map(message => (
          <div key={message.id} className="border-b border-slate-100 last:border-0 pb-1 mb-1">
            <ChatMessage
              msg={message}
              users={users}
              group={group}
              currentUser={currentUser}
              onTogglePin={onTogglePin ? () => onTogglePin(message.id) : null}
              compact
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
