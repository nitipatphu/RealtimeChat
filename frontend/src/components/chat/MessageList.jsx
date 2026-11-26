import ChatMessage from './ChatMessage';
import { dayLabel, isSameDay } from '../../utils/format';

export default function MessageList({ messages, allMessages, ...messageProps }) {
  return (
    <>
      {messages.map((msg, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || !isSameDay(previous.createdAt, msg.createdAt);

        let grouped = false;
        if (previous && !newDay && previous.authorId === msg.authorId) {
          const gap = new Date(msg.createdAt) - new Date(previous.createdAt);
          grouped = gap < 5 * 60 * 1000;
        }

        const replies = (allMessages || []).filter(m => m.parentId === msg.id);

        return (
          <div key={msg.id}>
            {newDay && (
              <div className="flex items-center gap-3 my-4 px-3">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs font-medium text-slate-500">{dayLabel(msg.createdAt)}</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>
            )}
            <ChatMessage
              msg={msg}
              grouped={grouped}
              replies={replies}
              onReply={messageProps.onReply ? () => messageProps.onReply(msg.id) : null}
              onEdit={messageProps.onEdit ? (text) => messageProps.onEdit(msg.id, text) : null}
              onDelete={messageProps.onDelete ? () => messageProps.onDelete(msg.id) : null}
              onToggleReaction={messageProps.onToggleReaction ? (emoji) => messageProps.onToggleReaction(msg.id, emoji) : null}
              users={messageProps.users}
              group={messageProps.group}
              currentUser={messageProps.currentUser}
              onOpenProfile={messageProps.onOpenProfile}
              canModerate={messageProps.canModerate}
              onTogglePin={messageProps.onTogglePin ? () => messageProps.onTogglePin(msg.id) : null}
              onVote={messageProps.onVote ? (optionId) => messageProps.onVote(msg.id, optionId) : null}
            />
          </div>
        );
      })}
    </>
  );
}
