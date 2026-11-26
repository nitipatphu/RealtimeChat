import { useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import { EmptyState } from '../ui/Card';
import { timeAgo } from '../../utils/format';

const TYPE_STYLE = {
  mention: { icon: 'at', cls: 'bg-amber-50 text-amber-600' },
  task: { icon: 'board', cls: 'bg-indigo-50 text-indigo-600' },
  vip: { icon: 'sparkles', cls: 'bg-fuchsia-50 text-fuchsia-600' },
  system: { icon: 'shield', cls: 'bg-slate-100 text-slate-600' },
  event: { icon: 'calendar', cls: 'bg-indigo-50 text-indigo-600' },
  group: { icon: 'users', cls: 'bg-emerald-50 text-emerald-600' }
};

export default function NotificationPanel({ notifications, onOpen, onReadAll, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const hasUnread = notifications.some(n => !n.read);

  return (
    <div ref={ref} className="absolute left-full top-0 ml-3 z-50 w-[22rem] max-w-[calc(100vw-90px)] max-h-[75vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl">
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
        <p className="text-base font-semibold text-slate-900">การแจ้งเตือน</p>
        {hasUnread && (
          <button type="button" onClick={onReadAll} className="text-sm text-indigo-600 hover:underline">อ่านทั้งหมด</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {notifications.length === 0 && <EmptyState icon="bell" title="ยังไม่มีการแจ้งเตือน" text="เมื่อมีคนแท็กคุณหรือมอบหมายงาน จะแสดงที่นี่" />}

        {notifications.map(notification => {
          const style = TYPE_STYLE[notification.type] || TYPE_STYLE.mention;
          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => { onOpen(notification); onClose(); }}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${notification.read ? 'hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.cls}`}>
                <Icon name={style.icon} className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${notification.read ? 'text-slate-700' : 'text-slate-900 font-semibold'}`}>{notification.title}</span>
                {notification.body && <span className="block text-sm text-slate-500 truncate">{notification.body}</span>}
                <span className="block text-xs text-slate-400 mt-0.5">{timeAgo(notification.createdAt)}</span>
              </span>
              {!notification.read && <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
