import { useState, useContext } from 'react';
import BlockedContext from '../../blockedContext';
import { apiSend } from '../../api';
import MessageText from './MessageText';
import MessageReactions from './MessageReactions';
import EmojiPicker from '../ui/EmojiPicker';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { IconButton } from '../ui/Button';
import { RoleBadge, VipBadge } from '../ui/Badge';
import { vipNameStyle } from '../../utils/vip';
import { textareaClass } from '../ui/Form';
import { formatTime, formatSize, timeAgo } from '../../utils/format';
import { getDisplayName, getMemberRole } from '../../utils/permissions';
import { showError } from '../../utils/dialog';

function AttachmentList({ attachments }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map(file => {
        const isImage = (file.type || '').startsWith('image/');
        if (isImage) {
          return (
            <a key={file.url} href={file.url} target="_blank" rel="noreferrer">
              <img src={file.url} alt={file.name} className="max-h-60 max-w-xs rounded-xl border border-slate-200 object-cover" />
            </a>
          );
        }
        return (
          <a
            key={file.url}
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 border border-slate-200 bg-white rounded-xl px-3 py-2.5 hover:border-indigo-300 transition-colors"
          >
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icon name="file" className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function PollCard({ poll, currentUserId, users, onVote }) {
  let totalVotes = 0;
  poll.options.forEach(option => {
    totalVotes = totalVotes + option.votes.length;
  });

  const voterNames = (ids) => ids.map(id => {
    const user = (users || []).find(u => u.id === id);
    return user ? user.name : 'ผู้ใช้';
  }).join(', ');

  return (
    <div className="mt-2 max-w-md rounded-xl border border-slate-200 bg-white p-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-1">
        <Icon name="poll" className="w-4 h-4 text-indigo-600" />
        <span className="text-xs font-medium text-slate-500">โพล{poll.multiple ? ' · เลือกได้หลายข้อ' : ''}</span>
      </div>
      <p className="text-base font-semibold text-slate-900 mb-3">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map(option => {
          const voted = option.votes.includes(currentUserId);
          const percent = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
          return (
            <button
              key={option.id}
              type="button"
              disabled={!onVote}
              onClick={() => onVote(option.id)}
              title={option.votes.length > 0 ? voterNames(option.votes) : 'ยังไม่มีคนโหวต'}
              className={`relative w-full text-left rounded-lg border overflow-hidden transition-colors ${voted ? 'border-indigo-400' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className={`absolute inset-y-0 left-0 ${voted ? 'bg-indigo-100' : 'bg-slate-100'}`} style={{ width: percent + '%' }} />
              <span className="relative flex items-center justify-between gap-3 px-3 h-10 text-sm">
                <span className="flex items-center gap-2 text-slate-800">
                  {voted && <Icon name="check" className="w-4 h-4 text-indigo-600" />}
                  {option.text}
                </span>
                <span className="text-slate-500 tabular-nums">{option.votes.length} · {percent}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-2">{totalVotes} โหวต · กดอีกครั้งเพื่อยกเลิก</p>
    </div>
  );
}

function ThreadSummary({ replies, users, onOpen }) {
  const people = [];
  replies.forEach(reply => {
    if (!people.includes(reply.authorId)) people.push(reply.authorId);
  });
  const lastReply = replies[replies.length - 1];

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onOpen) onOpen();
      }}
      className="group/thread mt-1.5 -ml-1.5 flex items-center gap-2 max-w-full rounded-lg border border-transparent px-1.5 py-1 text-left hover:border-slate-200 hover:bg-white"
    >
      <span className="flex -space-x-1.5 shrink-0">
        {people.slice(0, 3).map(userId => {
          const person = (users || []).find(u => u.id === userId);
          return (
            <span key={userId} className="rounded-md ring-2 ring-white">
              <Avatar src={person ? person.avatar : null} name={person ? person.name : '?'} size="xs" />
            </span>
          );
        })}
      </span>
      <span className="text-sm font-semibold text-indigo-600 hover:underline shrink-0">{replies.length} ตอบกลับ</span>
      <span className="text-xs text-slate-400 truncate group-hover/thread:hidden">ล่าสุด {timeAgo(lastReply.createdAt)}</span>
      <span className="text-xs text-slate-500 truncate hidden group-hover/thread:inline">ดู Thread</span>
    </button>
  );
}

export default function ChatMessage({
  msg,
  users,
  group,
  currentUser,
  replies,
  grouped,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onOpenProfile,
  canModerate,
  onTogglePin,
  onVote,
  compact
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [clipSaved, setClipSaved] = useState(false);
  const blockedIds = useContext(BlockedContext);

  const author = (users || []).find(u => u.id === msg.authorId);
  const authorName = author ? getDisplayName(group, author) : msg.author;
  const authorAvatar = author ? author.avatar : msg.avatar;
  const currentUserId = currentUser ? currentUser.id : null;
  const isMine = currentUser && msg.authorId === currentUser.id;
  const mentionsMe = currentUser && (msg.mentions || []).includes(currentUser.id);
  const role = group && author ? getMemberRole(group, author.id) : null;
  const showRole = role && role.id !== 'none' && !role.isDefault;

  const canDelete = onDelete && (isMine || canModerate);

  const saveToClipboard = async () => {
    try {
      await apiSend('POST', '/users/' + currentUser.id + '/clips', { title: '', text: msg.text, source: authorName });
      setClipSaved(true);
      setTimeout(() => setClipSaved(false), 2000);
    } catch (err) {
      showError(err.message);
    }
  };

  const startEdit = () => {
    setEditText(msg.text);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    const ok = await onEdit(editText);
    if (ok) {
      setIsEditing(false);
    }
  };

  const openProfile = () => {
    if (onOpenProfile && author) onOpenProfile(author.id);
  };

  const showHeader = !grouped || compact;

  const toggleActionsOnTouch = () => {
    if (window.innerWidth >= 768) return;
    setShowActions(!showActions);
  };

  if (!isMine && blockedIds.includes(msg.authorId) && !revealed) {
    return (
      <div id={'msg-' + msg.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400">
        <Icon name="ban" className="w-4 h-4" />
        <span>ข้อความจากผู้ใช้ที่คุณบล็อก</span>
        <button type="button" onClick={() => setRevealed(true)} className="text-indigo-600 hover:underline">แสดง</button>
      </div>
    );
  }

  return (
    <div
      id={'msg-' + msg.id}
      onClick={toggleActionsOnTouch}
      className={`group relative flex gap-3 rounded-xl px-3 ${showHeader ? 'pt-2.5 pb-1.5 mt-1' : 'py-0.5'} ${
        mentionsMe ? 'bg-amber-50/80 hover:bg-amber-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className={compact ? 'w-8 shrink-0' : 'w-10 shrink-0'}>
        {showHeader ? (
          <button type="button" onClick={openProfile} className="block">
            <Avatar src={authorAvatar} name={authorName} size={compact ? 'sm' : 'md'} />
          </button>
        ) : (
          <span className="hidden group-hover:block text-[11px] text-slate-400 text-right pt-1 tabular-nums">
            {formatTime(msg.createdAt).slice(-5)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={openProfile} className="text-sm font-semibold hover:underline text-slate-900" style={vipNameStyle(author)}>
              {authorName}
            </button>
            {author && <VipBadge user={author} size="icon" />}
            {showRole && !compact && <RoleBadge role={role} />}
            <span className="text-xs text-slate-400">{formatTime(msg.createdAt)}</span>
            {msg.isEdited && <span className="text-xs text-slate-400">(แก้ไขแล้ว)</span>}
            {msg.pinned && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <Icon name="bookmark" className="w-3.5 h-3.5" />
                ปักหมุด
              </span>
            )}
          </div>
        )}

        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              rows="2"
              autoFocus
              className={textareaClass}
            />
            <p className="text-xs text-slate-500 mt-1">
              Enter เพื่อบันทึก · Esc เพื่อยกเลิก ·{' '}
              <button type="button" onClick={saveEdit} className="text-indigo-600 font-medium hover:underline">บันทึก</button>
            </p>
          </div>
        ) : (
          <MessageText text={msg.text} users={users} currentUser={currentUser} />
        )}

        {msg.poll && <PollCard poll={msg.poll} currentUserId={currentUserId} users={users} onVote={onVote} />}

        <AttachmentList attachments={msg.attachments} />

        {(onToggleReaction || Object.keys(msg.reactions || {}).length > 0) && (
          <MessageReactions reactions={msg.reactions} currentUserId={currentUserId} users={users} onToggle={onToggleReaction} />
        )}

        {replies && replies.length > 0 && (
          <ThreadSummary replies={replies} users={users} onOpen={onReply} />
        )}
      </div>

      {!isEditing && (
        <div className={`absolute right-3 -top-3 bg-white border border-slate-200 rounded-lg shadow-sm p-0.5 flex z-10 ${showPicker || showActions ? 'flex' : 'hidden group-hover:flex'}`}>
          {onToggleReaction && (
            <div className="relative">
              <IconButton icon="smile" title="รีแอคชัน" size="sm" onClick={() => setShowPicker(!showPicker)} />
              {showPicker && (
                <EmojiPicker
                  onClose={() => setShowPicker(false)}
                  onPick={(emoji) => {
                    setShowPicker(false);
                    onToggleReaction(emoji);
                  }}
                />
              )}
            </div>
          )}
          {onReply && <IconButton icon="reply" title="ตอบกลับใน Thread" size="sm" onClick={onReply} />}
          {currentUser && msg.text && (
            <IconButton
              icon={clipSaved ? 'check' : 'clipboard'}
              title={clipSaved ? 'เก็บลงคลิปบอร์ดแล้ว' : 'เก็บลงคลิปบอร์ดของฉัน'}
              size="sm"
              active={clipSaved}
              onClick={saveToClipboard}
            />
          )}
          {isMine && onEdit && msg.text && <IconButton icon="pencil" title="แก้ไข" size="sm" onClick={startEdit} />}
          {onTogglePin && <IconButton icon="bookmark" title={msg.pinned ? 'เลิกปักหมุด' : 'ปักหมุดข้อความ'} size="sm" onClick={onTogglePin} />}
          {canDelete && <IconButton icon="trash" title={isMine ? 'ลบ' : 'ลบ (ผู้ดูแล)'} size="sm" danger onClick={onDelete} />}
        </div>
      )}
    </div>
  );
}
