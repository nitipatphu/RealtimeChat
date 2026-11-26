import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { IconButton } from '../ui/Button';
import { useCloseOnBack } from '../../utils/backButton';

export default function ThreadPanel({
  parentMsg,
  replies,
  users,
  group,
  currentUser,
  mentionMembers,
  canMentionEveryone,
  canModerate,
  typingRoom,
  typingToUserIds,
  onClose,
  onSend,
  onEdit,
  onDelete,
  onToggleReaction,
  onOpenProfile,
  readOnly
}) {
  const bottomRef = useRef(null);
  useCloseOnBack(onClose);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [replies.length]);

  return (
    <aside className="fixed inset-0 z-40 md:static md:z-auto w-full md:w-[380px] border-l border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
        <div>
          <p className="text-sm font-semibold text-slate-900">Thread</p>
          <p className="text-xs text-slate-500">{replies.length} ตอบกลับ</p>
        </div>
        <IconButton icon="x" title="ปิด Thread" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-1">
        <div className="pb-3 mb-2 border-b border-slate-100">
          <ChatMessage
            msg={parentMsg}
            users={users}
            group={group}
            currentUser={currentUser}
            onToggleReaction={onToggleReaction ? (emoji) => onToggleReaction(parentMsg.id, emoji) : null}
            onOpenProfile={onOpenProfile}
            compact
          />
        </div>

        {replies.map(reply => (
          <ChatMessage
            key={reply.id}
            msg={reply}
            users={users}
            group={group}
            currentUser={currentUser}
            canModerate={canModerate}
            onEdit={onEdit ? (text) => onEdit(reply.id, text) : null}
            onDelete={onDelete ? () => onDelete(reply.id) : null}
            onToggleReaction={onToggleReaction ? (emoji) => onToggleReaction(reply.id, emoji) : null}
            onOpenProfile={onOpenProfile}
            compact
          />
        ))}

        {replies.length === 0 && <p className="text-center text-sm text-slate-400 py-6">ยังไม่มีการตอบกลับ</p>}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
      <div className="px-3 pb-3 shrink-0">
        <TypingIndicator room={typingRoom} currentUserId={currentUser ? currentUser.id : null} />
        <ChatInput
          onSend={onSend}
          placeholder="ตอบกลับใน Thread..."
          mentionMembers={mentionMembers}
          canMentionEveryone={canMentionEveryone}
          currentUser={currentUser}
          typingRoom={typingRoom}
          typingToUserIds={typingToUserIds}
          draftKey={typingRoom}
          compact
        />
      </div>
      )}
    </aside>
  );
}
