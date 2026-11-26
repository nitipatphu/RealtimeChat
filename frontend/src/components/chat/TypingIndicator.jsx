import { useState, useEffect } from 'react';
import socket from '../../socket';

export default function TypingIndicator({ room, currentUserId }) {
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    const handleTyping = (data) => {
      if (data.room !== room) return;
      if (data.userId === currentUserId) return;

      setTypingUsers(prev => ({ ...prev, [data.userId]: { name: data.name, room: data.room, time: Date.now() } }));
    };

    const timer = setInterval(() => {
      setTypingUsers(prev => {
        const next = {};
        let changed = false;
        Object.keys(prev).forEach(id => {
          if (Date.now() - prev[id].time < 3500) {
            next[id] = prev[id];
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    socket.on('typing', handleTyping);
    return () => {
      socket.off('typing', handleTyping);
      clearInterval(timer);
    };
  }, [room, currentUserId]);

  const names = Object.keys(typingUsers)
    .filter(id => typingUsers[id].room === room)
    .map(id => typingUsers[id].name);

  let label = '';
  if (names.length === 1) label = names[0] + ' กำลังพิมพ์...';
  if (names.length === 2) label = names[0] + ' และ ' + names[1] + ' กำลังพิมพ์...';
  if (names.length > 2) label = 'หลายคนกำลังพิมพ์...';

  return (
    <div className="h-6 px-1 flex items-center gap-2 text-xs text-slate-500">
      {label && (
        <span className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
        </span>
      )}
      {label}
    </div>
  );
}
