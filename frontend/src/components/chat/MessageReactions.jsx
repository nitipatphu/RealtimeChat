import { useState } from 'react';
import Icon from '../ui/Icon';
import EmojiPicker from '../ui/EmojiPicker';

export default function MessageReactions({ reactions, currentUserId, users, onToggle }) {
  const [showPicker, setShowPicker] = useState(false);

  const list = [];
  Object.keys(reactions || {}).forEach(emoji => {
    const userIds = reactions[emoji];
    if (Array.isArray(userIds) && userIds.length > 0) {
      list.push({ emoji: emoji, userIds: userIds });
    }
  });

  if (list.length === 0) return null;

  const getNames = (userIds) => {
    return userIds
      .map(id => {
        const user = (users || []).find(u => u.id === id);
        return user ? user.name : 'ผู้ใช้';
      })
      .join(', ');
  };

  return (
    <div className="flex items-center flex-wrap gap-1.5 mt-1.5 relative">
      {list.map(item => {
        const reactedByMe = item.userIds.includes(currentUserId);
        return (
          <button
            key={item.emoji}
            type="button"
            onClick={() => { if (onToggle) onToggle(item.emoji); }}
            disabled={!onToggle}
            title={getNames(item.userIds)}
            className={`h-7 px-2 rounded-full border text-sm flex items-center gap-1 transition-colors ${
              reactedByMe ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <span>{item.emoji}</span>
            <span className="text-xs font-semibold tabular-nums">{item.userIds.length}</span>
          </button>
        );
      })}
      {onToggle && (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          title="เพิ่มรีแอคชัน"
          className="h-7 w-7 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center"
        >
          <Icon name="smile" className="w-4 h-4" />
        </button>
        {showPicker && (
          <EmojiPicker
            position="left-0 bottom-full mb-1"
            onClose={() => setShowPicker(false)}
            onPick={(emoji) => {
              setShowPicker(false);
              onToggle(emoji);
            }}
          />
        )}
      </div>
      )}
    </div>
  );
}
